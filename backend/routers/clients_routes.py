from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import ServerSelectionTimeoutError
from database import get_db, TIENDAS_INFO
from auth import get_current_user
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter(prefix="/clientes", tags=["clientes"])


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/{tienda_key}")
async def buscar_clientes(
    tienda_key: str,
    q: str = Query("", description="Búsqueda por nombre, email o teléfono"),
    limit: int = Query(8, ge=1, le=20),
    user: dict = Depends(get_current_user),
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db = get_db(tienda_key)
        filtro: dict = {}
        if q:
            filtro["$or"] = [
                {"nombre":   {"$regex": q, "$options": "i"}},
                {"email":    {"$regex": q, "$options": "i"}},
                {"telefono": {"$regex": q, "$options": "i"}},
                {"rfc":      {"$regex": q, "$options": "i"}},
            ]
        docs = list(db["clientes"].find(filtro).limit(limit))
        return [_serialize(d) for d in docs]
    except ServerSelectionTimeoutError:
        raise HTTPException(503, "Nodo no disponible")


@router.post("/{tienda_key}")
async def crear_cliente(
    tienda_key: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    nombre = (body.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(400, "El nombre es obligatorio")
    try:
        db = get_db(tienda_key)
        doc = {
            "nombre":          nombre,
            "email":           (body.get("email") or "").strip(),
            "telefono":        (body.get("telefono") or "").strip(),
            "ciudad":          (body.get("ciudad") or "Aguascalientes").strip(),
            "rfc":             (body.get("rfc") or "").strip().upper(),
            "fecha_registro":  datetime.now(timezone.utc).isoformat(),
        }
        result = db["clientes"].insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc
    except ServerSelectionTimeoutError:
        raise HTTPException(503, "Nodo no disponible")
