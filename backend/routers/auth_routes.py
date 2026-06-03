from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import ServerSelectionTimeoutError
from database import (
    get_central_db, get_db_with_fallback, get_client,
    TIENDA_NODO, is_node_up, NODO4_DB_PREFIX,
)
from auth import verify_password, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _find_user_in_tienda(username: str, tienda_key: str) -> dict | None:
    """
    Busca un usuario en la tienda usando la cadena de fallback completa:
      primario → bkp_* → nodo 4
    Retorna el doc del usuario o None.
    """
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
        return db["usuarios"].find_one({"username": username})
    except Exception:
        return None


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    username = form.username.strip()
    password = form.password
    user = None

    # ── 1. BD central (admins / supervisores globales) ──────────────────────
    # Intenta nodo 1, si cae busca en nodo 4 (global_oxxo_central)
    central_encontrado = False
    try:
        central = get_central_db()
        user = central["usuarios"].find_one({"username": username})
        central_encontrado = True
    except Exception:
        pass

    if not central_encontrado and is_node_up(4):
        # Fallback: buscar en la réplica del nodo 4
        try:
            n4_central = get_client(4)["global_oxxo_central"]
            user = n4_central["usuarios"].find_one({"username": username})
        except Exception:
            pass

    # ── 2. Si no está en central, buscar en las tiendas ─────────────────────
    if not user:
        # Agrupar tiendas por nodo para saber cuáles nodos están caídos
        nodos_caidos: set[int] = set()

        for tienda_key, nodo in TIENDA_NODO.items():
            found = _find_user_in_tienda(username, tienda_key)
            if found:
                user = found
                break
            # Si el nodo primario está caído Y no tenemos respaldo disponible
            if not is_node_up(nodo):
                nodos_caidos.add(nodo)

        # Si no se encontró y todos los posibles nodos estaban totalmente caídos
        # (sin respaldo ni nodo 4) → avisar. Pero solo si realmente no hay
        # ningún camino posible.
        if not user and nodos_caidos:
            # Verificar si el nodo 4 tampoco está disponible para concluir
            # que el usuario podría estar en un nodo inaccesible.
            # Damos un mensaje informativo pero NO bloqueamos si todavía
            # hay algún nodo activo que pudo haberlo buscado sin éxito.
            nodos_activos = {n for n in [1, 2, 3] if is_node_up(n)}
            if not nodos_activos and not is_node_up(4):
                raise HTTPException(
                    status_code=503,
                    detail="Todos los nodos están fuera de línea. El sistema no está disponible."
                )
            # Si hay nodos activos y aun así no se encontró → credenciales incorrectas

    # ── 3. Validar credenciales ──────────────────────────────────────────────
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    token_data = {
        "sub": str(user["_id"]),
        "username": user["username"],
        "role": user["role"],
        "nombre": user.get("nombre", username),
        "tienda": user.get("tienda", None),
    }

    token = create_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "nombre": user.get("nombre", username),
        "tienda": user.get("tienda", None),
        "username": user["username"],
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
