from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from pymongo.errors import ServerSelectionTimeoutError
from database import (
    get_db_with_fallback, get_all_dbs_safe_with_fallback, TIENDAS_INFO,
    TIENDA_NODO, replicate_insert, replicate_update,
)
from auth import get_current_user, require_admin
from bson import ObjectId

router = APIRouter(prefix="/productos", tags=["productos"])


class ProductoBase(BaseModel):
    nombre: str
    categoria: str
    precio: float
    stock: int
    codigo_barras: Optional[str] = None
    proveedor: Optional[str] = None


class StockUpdate(BaseModel):
    cantidad: int


def serial(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/{tienda_key}")
async def get_productos(
    tienda_key: str,
    categoria: Optional[str] = None,
    buscar: Optional[str] = None,
    stock_min: Optional[int] = None,
    stock_max: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")

    filtro = {}
    if categoria:
        filtro["categoria"] = categoria
    if buscar:
        filtro["nombre"] = {"$regex": buscar, "$options": "i"}
    if stock_min is not None or stock_max is not None:
        filtro["stock"] = {}
        if stock_min is not None:
            filtro["stock"]["$gte"] = stock_min
        if stock_max is not None:
            filtro["stock"]["$lte"] = stock_max

    try:
        db, desde_respaldo, _ = get_db_with_fallback(tienda_key)
        total = db["productos"].count_documents(filtro)
        skip = (page - 1) * limit
        productos = list(db["productos"].find(filtro).skip(skip).limit(limit))
    except ConnectionError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo}, respaldo y Nodo 4 no disponibles")
    except ServerSelectionTimeoutError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} no disponible")

    return {
        "total": total, "page": page, "limit": limit,
        "productos": [serial(p) for p in productos],
        "desde_respaldo": desde_respaldo,
    }


@router.post("/{tienda_key}")
async def crear_producto(tienda_key: str, producto: ProductoBase, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    if user["role"] not in ("admin", "supervisor", "gerente") and user.get("tienda") != tienda_key:
        raise HTTPException(403, "Acceso denegado")
    try:
        db, _, nivel = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo, respaldo y Nodo 4 no disponibles")

    doc = producto.model_dump()
    result = db["productos"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    # Replicar en niveles superiores (usando el ObjectId original para consistencia)
    replicate_insert(tienda_key, "productos", {**doc, "_id": result.inserted_id}, skip_level=nivel)
    return doc


@router.put("/{tienda_key}/{producto_id}")
async def actualizar_producto(
    tienda_key: str, producto_id: str, producto: ProductoBase, user: dict = Depends(get_current_user)
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, _, nivel = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo, respaldo y Nodo 4 no disponibles")

    upd = {"$set": producto.model_dump()}
    result = db["productos"].update_one({"_id": ObjectId(producto_id)}, upd)
    if result.matched_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    replicate_update(tienda_key, "productos", {"_id": ObjectId(producto_id)}, upd, skip_level=nivel)
    return {"mensaje": "Producto actualizado"}


@router.delete("/{tienda_key}/{producto_id}")
async def eliminar_producto(tienda_key: str, producto_id: str, user: dict = Depends(require_admin)):
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo no disponible")
    result = db["productos"].delete_one({"_id": ObjectId(producto_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return {"mensaje": "Producto eliminado"}


@router.patch("/{tienda_key}/{producto_id}/stock")
async def actualizar_stock(
    tienda_key: str, producto_id: str, body: StockUpdate, user: dict = Depends(get_current_user)
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    if user["role"] == "cajero":
        raise HTTPException(403, "Solo gerentes y administradores pueden reabastecer")
    if user["role"] == "gerente" and user.get("tienda") != tienda_key:
        raise HTTPException(403, "Solo puedes reabastecer tu sucursal")
    if body.cantidad == 0:
        raise HTTPException(400, "La cantidad debe ser distinta de cero")

    try:
        db, _, nivel = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo, respaldo y Nodo 4 no disponibles")

    prod = db["productos"].find_one({"_id": ObjectId(producto_id)})
    if not prod:
        raise HTTPException(404, "Producto no encontrado")

    nuevo_stock = max(0, prod["stock"] + body.cantidad)
    upd = {"$set": {"stock": nuevo_stock}}
    db["productos"].update_one({"_id": ObjectId(producto_id)}, upd)
    replicate_update(tienda_key, "productos", {"_id": ObjectId(producto_id)}, upd, skip_level=nivel)
    return {"mensaje": "Stock actualizado", "stock_anterior": prod["stock"], "stock_nuevo": nuevo_stock}


@router.get("/disponibilidad/buscar")
async def buscar_disponibilidad(
    nombre: str = Query(..., min_length=2),
    user: dict = Depends(get_current_user)
):
    """Busca un producto en todas las tiendas (con fallback a respaldo y nodo4)."""
    TIENDA_NOMBRES = {
        'tienda_centro': 'NovaPOS Centro',   'tienda_norte': 'NovaPOS Norte',
        'tienda_sur': 'NovaPOS Sur',         'tienda_este': 'NovaPOS Este',
        'tienda_oeste': 'NovaPOS Oeste',     'tienda_universidad': 'NovaPOS Universidad',
        'tienda_insurgentes': 'NovaPOS Insurgentes', 'tienda_tecnologico': 'NovaPOS Tecnológico',
        'tienda_alameda': 'NovaPOS Alameda', 'tienda_jardines': 'NovaPOS Jardines',
    }
    resultados = []
    nodos_caidos: list[int] = []

    for tienda_key, db, desde_respaldo in get_all_dbs_safe_with_fallback():
        try:
            productos = list(db["productos"].find(
                {"nombre": {"$regex": nombre, "$options": "i"}},
                {"nombre": 1, "stock": 1, "precio": 1, "categoria": 1}
            ).limit(3))
            for p in productos:
                resultados.append({
                    "_id": str(p["_id"]),
                    "tienda_key": tienda_key,
                    "tienda_nombre": TIENDA_NOMBRES.get(tienda_key, tienda_key),
                    "nodo": TIENDA_NODO.get(tienda_key, 0),
                    "nombre": p["nombre"],
                    "stock": p["stock"],
                    "precio": p["precio"],
                    "categoria": p.get("categoria", ""),
                    "desde_respaldo": desde_respaldo,
                })
        except Exception:
            n = TIENDA_NODO.get(tienda_key, 0)
            if n not in nodos_caidos:
                nodos_caidos.append(n)

    resultados.sort(key=lambda x: (-x["stock"], x["tienda_nombre"]))
    return {"resultados": resultados, "nodos_caidos": nodos_caidos}


@router.get("/{tienda_key}/stats/resumen")
async def stats_inventario(tienda_key: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, desde_respaldo, _ = get_db_with_fallback(tienda_key)
        total    = db["productos"].count_documents({})
        sin_stock = db["productos"].count_documents({"stock": 0})
        critico  = db["productos"].count_documents({"stock": {"$gt": 0, "$lte": 10}})
        ok       = total - sin_stock - critico
    except (ConnectionError, ServerSelectionTimeoutError):
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} no disponible")
    return {"total": total, "sin_stock": sin_stock, "critico": critico, "ok": ok, "desde_respaldo": desde_respaldo}


@router.get("/{tienda_key}/categorias/lista")
async def get_categorias(tienda_key: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
        return db["productos"].distinct("categoria")
    except Exception:
        return []
