from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import ServerSelectionTimeoutError
from database import get_db, get_central_db, get_client, TIENDAS_INFO, TIENDA_NODO, NODO4_DB_PREFIX
from auth import get_current_user
from bson import ObjectId
import json

router = APIRouter(prefix="/explorer", tags=["explorer"])

NODO_TIENDAS = {
    1: ["oxxo_central"] + [k for k, n in TIENDA_NODO.items() if n == 1],
    2: [k for k, n in TIENDA_NODO.items() if n == 2],
    3: [k for k, n in TIENDA_NODO.items() if n == 3],
}
NODO_PORTS = {1: 27017, 2: 27018, 3: 27019, 4: 27020}
COLLECTIONS = ["productos", "ventas", "clientes", "usuarios"]


def _require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo el administrador puede usar el explorador")
    return user


def _serialize(doc: dict) -> dict:
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


@router.get("/nodos")
async def get_nodos(user: dict = Depends(_require_admin)):
    resultado = []

    # Nodos 1-3 con sus tiendas primarias
    for nodo_num in [1, 2, 3]:
        nodo_info = {
            "nodo": nodo_num, "puerto": NODO_PORTS[nodo_num],
            "activo": False, "bases": [], "recovery": False,
        }
        try:
            client = get_client(nodo_num)
            client.admin.command("ping")
            nodo_info["activo"] = True

            dbs = NODO_TIENDAS[nodo_num]
            for db_name in dbs:
                if db_name == "oxxo_central":
                    db = get_central_db()
                else:
                    db = get_db(db_name)
                cols = []
                for col in COLLECTIONS:
                    try:
                        count = db[col].count_documents({})
                        cols.append({"nombre": col, "documentos": count})
                    except Exception:
                        cols.append({"nombre": col, "documentos": 0})
                nodo_info["bases"].append({
                    "nombre": db_name,
                    "label": "oxxo_central" if db_name == "oxxo_central" else TIENDAS_INFO.get(db_name, {}).get("nombre", db_name),
                    "colecciones": cols,
                    "total_docs": sum(c["documentos"] for c in cols),
                    "prefijo": "",
                })
        except ServerSelectionTimeoutError:
            nodo_info["activo"] = False
        resultado.append(nodo_info)

    # Nodo 4 — réplica global (prefijo global_*)
    nodo4_info = {
        "nodo": 4, "puerto": 27020, "activo": False, "bases": [], "recovery": True,
    }
    try:
        client4 = get_client(4)
        client4.admin.command("ping")
        nodo4_info["activo"] = True

        for tienda_key in list(TIENDA_NODO.keys()):
            db_name_global = f"{NODO4_DB_PREFIX}{tienda_key}"
            db = client4[db_name_global]
            cols = []
            for col in COLLECTIONS:
                try:
                    count = db[col].count_documents({})
                    cols.append({"nombre": col, "documentos": count})
                except Exception:
                    cols.append({"nombre": col, "documentos": 0})
            nodo4_info["bases"].append({
                "nombre": db_name_global,
                "label": TIENDAS_INFO.get(tienda_key, {}).get("nombre", tienda_key),
                "colecciones": cols,
                "total_docs": sum(c["documentos"] for c in cols),
                "prefijo": NODO4_DB_PREFIX,
            })
    except ServerSelectionTimeoutError:
        nodo4_info["activo"] = False
    resultado.append(nodo4_info)

    return resultado


@router.get("/{db_name}/{collection}")
async def get_documentos(
    db_name: str,
    collection: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    buscar: str = Query("", alias="q"),
    user: dict = Depends(_require_admin),
):
    if collection not in COLLECTIONS:
        raise HTTPException(400, "Colección no permitida")

    is_global = db_name.startswith(NODO4_DB_PREFIX)
    if db_name == "oxxo_central":
        db = get_central_db()
    elif is_global:
        # Leer directamente del nodo 4
        try:
            client4 = get_client(4)
            client4.admin.command("ping")
            db = client4[db_name]
        except ServerSelectionTimeoutError:
            raise HTTPException(503, "Nodo 4 (réplica global) no disponible")
    elif db_name in TIENDAS_INFO:
        db = get_db(db_name)
    else:
        raise HTTPException(404, "Base de datos no encontrada")

    filtro = {}
    if buscar:
        filtro["$or"] = [
            {"nombre": {"$regex": buscar, "$options": "i"}},
            {"username": {"$regex": buscar, "$options": "i"}},
        ]

    try:
        total = db[collection].count_documents(filtro)
        skip = (page - 1) * limit
        docs = list(db[collection].find(filtro).skip(skip).limit(limit))
        docs_clean = [_serialize(d) for d in docs]
    except ServerSelectionTimeoutError:
        raise HTTPException(503, "Nodo no disponible")

    # Extraer campos únicos para encabezados de tabla
    keys: list[str] = []
    for d in docs_clean:
        for k in d.keys():
            if k not in keys:
                keys.append(k)

    return {"total": total, "page": page, "limit": limit, "keys": keys, "docs": docs_clean}


@router.patch("/{db_name}/{collection}/{doc_id}")
async def update_documento(
    db_name: str, collection: str, doc_id: str,
    body: dict,
    user: dict = Depends(_require_admin),
):
    if collection not in COLLECTIONS:
        raise HTTPException(400, "Colección no permitida")
    is_global = db_name.startswith(NODO4_DB_PREFIX)
    if db_name == "oxxo_central":
        db = get_central_db()
    elif is_global:
        try:
            client4 = get_client(4)
            client4.admin.command("ping")
            db = client4[db_name]
        except ServerSelectionTimeoutError:
            raise HTTPException(503, "Nodo 4 (réplica global) no disponible")
    elif db_name in TIENDAS_INFO:
        db = get_db(db_name)
    else:
        raise HTTPException(404, "Base de datos no encontrada")

    # Proteger campos sensibles
    body.pop("_id", None)
    body.pop("password", None)

    try:
        result = db[collection].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": body}
        )
    except Exception as e:
        raise HTTPException(400, f"Error al actualizar: {e}")

    if result.matched_count == 0:
        raise HTTPException(404, "Documento no encontrado")
    return {"mensaje": "Documento actualizado", "modificados": result.modified_count}
