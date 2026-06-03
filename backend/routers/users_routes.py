from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import (
    get_central_db, get_db_with_fallback, get_client,
    TIENDAS_INFO, TIENDA_NODO, replicate_insert, is_node_up, NODO4_DB_PREFIX,
)
from auth import get_current_user, hash_password
from bson import ObjectId

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


class NuevoUsuario(BaseModel):
    username: str
    password: str
    nombre: str
    role: str
    tienda: Optional[str] = None


PRIVILEGED = ('admin', 'supervisor')


def _allowed_roles(creator_role: str) -> list[str]:
    if creator_role == 'admin':
        return ['admin', 'supervisor', 'gerente', 'cajero']
    if creator_role == 'supervisor':
        return ['gerente', 'cajero']
    if creator_role == 'gerente':
        return ['cajero']
    return []


def _serial(u: dict, show_password: bool = False) -> dict:
    u['_id'] = str(u['_id'])
    u.pop('password', None)
    if not show_password:
        u.pop('password_plain', None)
    return u


def _replicate_central_user(doc: dict) -> None:
    """Replica un usuario de oxxo_central al nodo 4 (global_oxxo_central)."""
    if is_node_up(4):
        try:
            n4 = get_client(4)["global_oxxo_central"]
            n4["usuarios"].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        except Exception:
            pass


@router.get("/")
async def list_usuarios(user: dict = Depends(get_current_user)):
    if user['role'] not in (*PRIVILEGED, 'gerente'):
        raise HTTPException(403, "Acceso denegado")

    show_pw = user['role'] == 'admin'
    usuarios = []

    # Central (con fallback a nodo 4 si cae el nodo 1)
    try:
        central = get_central_db()
        for u in central['usuarios'].find({}):
            usuarios.append({**_serial(u, show_password=show_pw), 'origen': 'central'})
    except Exception:
        if is_node_up(4):
            try:
                n4_central = get_client(4)["global_oxxo_central"]
                for u in n4_central['usuarios'].find({}):
                    usuarios.append({**_serial(u, show_password=show_pw), 'origen': 'central (réplica)'})
            except Exception:
                pass

    for tienda_key in TIENDAS_INFO:
        if user['role'] == 'gerente' and user.get('tienda') != tienda_key:
            continue
        try:
            db, _, _ = get_db_with_fallback(tienda_key)
            for u in db['usuarios'].find({}):
                usuarios.append({**_serial(u, show_password=show_pw), 'origen': tienda_key})
        except Exception:
            continue

    return usuarios


@router.post("/")
async def crear_usuario(nuevo: NuevoUsuario, creator: dict = Depends(get_current_user)):
    allowed = _allowed_roles(creator['role'])
    if not allowed:
        raise HTTPException(403, "Sin permisos para crear usuarios")
    if nuevo.role not in allowed:
        raise HTTPException(403, f"Solo puedes crear roles: {', '.join(allowed)}")

    if creator['role'] == 'gerente' and nuevo.tienda != creator.get('tienda'):
        raise HTTPException(403, "Solo puedes agregar usuarios a tu sucursal")

    if nuevo.role in ('gerente', 'cajero') and nuevo.tienda not in TIENDAS_INFO:
        raise HTTPException(400, "Tienda inválida")

    doc = {
        'username': nuevo.username,
        'password': hash_password(nuevo.password),
        'password_plain': nuevo.password,
        'nombre': nuevo.nombre,
        'role': nuevo.role,
        'tienda': nuevo.tienda if nuevo.role in ('gerente', 'cajero') else None,
    }

    if nuevo.role in ('admin', 'supervisor') or nuevo.tienda is None:
        central = get_central_db()
        if central['usuarios'].find_one({'username': nuevo.username}):
            raise HTTPException(400, "Nombre de usuario ya existe")
        result = central['usuarios'].insert_one(doc)
        doc['_id'] = result.inserted_id
        # Replicar al nodo 4 inmediatamente
        _replicate_central_user(doc)
    else:
        try:
            db, _, nivel = get_db_with_fallback(nuevo.tienda)
        except ConnectionError:
            raise HTTPException(503, "Nodo de la tienda no disponible")
        if db['usuarios'].find_one({'username': nuevo.username}):
            raise HTTPException(400, "Nombre de usuario ya existe en esa sucursal")
        result = db['usuarios'].insert_one(doc)
        doc['_id'] = result.inserted_id
        # Replicar en bkp_* y nodo 4
        replicate_insert(nuevo.tienda, 'usuarios', {**doc}, skip_level=nivel)

    doc['_id'] = str(doc.get('_id', ''))
    doc.pop('password', None)
    return {'mensaje': 'Usuario creado', 'usuario': doc}


@router.delete("/{username}")
async def eliminar_usuario(username: str, creator: dict = Depends(get_current_user)):
    if creator['role'] not in (*PRIVILEGED, 'gerente'):
        raise HTTPException(403, "Acceso denegado")
    if username == creator['username']:
        raise HTTPException(400, "No puedes eliminarte a ti mismo")

    central = get_central_db()
    target_central = central['usuarios'].find_one({'username': username})
    if target_central and target_central.get('role') in ('admin', 'supervisor'):
        if creator['role'] != 'admin':
            raise HTTPException(403, "Solo el administrador puede eliminar cuentas admin o supervisor")
    r = central['usuarios'].delete_one({'username': username})
    if r.deleted_count:
        # También eliminar de réplica nodo 4
        if is_node_up(4):
            try:
                get_client(4)["global_oxxo_central"]["usuarios"].delete_one({'username': username})
            except Exception:
                pass
        return {'mensaje': 'Usuario eliminado'}

    for tienda_key in TIENDAS_INFO:
        if creator['role'] == 'gerente' and creator.get('tienda') != tienda_key:
            continue
        try:
            db, _, _ = get_db_with_fallback(tienda_key)
            r = db['usuarios'].delete_one({'username': username})
            if r.deleted_count:
                return {'mensaje': 'Usuario eliminado'}
        except Exception:
            continue

    raise HTTPException(404, "Usuario no encontrado")
