from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from pymongo.errors import ServerSelectionTimeoutError
from database import get_db_with_fallback, replicate_insert, replicate_update, TIENDAS_INFO, TIENDA_NODO
from auth import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/ventas", tags=["ventas"])


class ItemVenta(BaseModel):
    producto_id: str
    cantidad: int
    precio_unitario: float


class NuevaVenta(BaseModel):
    tienda_key: str
    cliente_nombre: Optional[str] = "Cliente General"
    items: List[ItemVenta]
    metodo_pago: str = "efectivo"


def obj_id_to_str(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("/")
async def crear_venta(venta: NuevaVenta, user: dict = Depends(get_current_user)):
    tienda_key = venta.tienda_key
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")

    # Control de acceso por sucursal
    if user["role"] not in ("admin", "supervisor") and user.get("tienda") != tienda_key:
        raise HTTPException(403, "Solo puedes registrar ventas en tu sucursal")

    try:
        db, desde_respaldo, nivel = get_db_with_fallback(tienda_key)
    except ConnectionError:
        nodo = TIENDA_NODO.get(tienda_key, "?")
        raise HTTPException(503, f"Nodo {nodo}, respaldo y Nodo 4 no disponibles")

    subtotal = 0.0
    items_doc = []

    for item in venta.items:
        prod = db["productos"].find_one({"_id": ObjectId(item.producto_id)})
        if not prod:
            raise HTTPException(404, f"Producto {item.producto_id} no encontrado")
        if prod.get("stock", 0) < item.cantidad:
            raise HTTPException(400, f"Stock insuficiente para {prod['nombre']}")

        linea = item.cantidad * item.precio_unitario
        subtotal += linea
        items_doc.append({
            "producto_id": item.producto_id,
            "nombre": prod["nombre"],
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "subtotal": round(linea, 2),
        })

        # Descontar stock en el nodo donde estamos escribiendo
        stock_filter = {"_id": ObjectId(item.producto_id)}
        stock_update = {"$inc": {"stock": -item.cantidad}}
        db["productos"].update_one(stock_filter, stock_update)
        # Replicar en los niveles superiores (sin repetir el nivel actual)
        replicate_update(tienda_key, "productos", stock_filter, stock_update, skip_level=nivel)

    iva = round(subtotal * 0.16, 2)
    total = round(subtotal + iva, 2)

    doc = {
        "tienda_key": tienda_key,
        "tienda_nombre": TIENDAS_INFO[tienda_key]["nombre"],
        "cajero": user["username"],
        "cliente_nombre": venta.cliente_nombre,
        "items": items_doc,
        "subtotal": round(subtotal, 2),
        "iva": iva,
        "total": total,
        "metodo_pago": venta.metodo_pago,
        "fecha": datetime.now(timezone.utc).isoformat(),
        "nodo": TIENDA_NODO[tienda_key],
        "nodo_escritura": nivel,   # 0=primario, 1=bkp, 2=nodo4
    }

    result = db["ventas"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    # Replicar en los niveles superiores (sin repetir el nivel donde ya escribimos)
    doc_rep = {**doc}
    replicate_insert(tienda_key, "ventas", doc_rep, skip_level=nivel)

    aviso = None
    if nivel == 1:
        aviso = "Venta registrada en nodo de respaldo (nodo primario caído)"
    elif nivel == 2:
        aviso = "Venta registrada en Nodo 4 (primario y respaldo caídos)"

    return {"mensaje": "Venta registrada exitosamente", "venta": doc, "aviso": aviso, "desde_respaldo": desde_respaldo}


@router.get("/{tienda_key}")
async def get_ventas(
    tienda_key: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    if user["role"] not in ("admin", "supervisor") and user.get("tienda") != tienda_key:
        raise HTTPException(403, "Acceso denegado")

    skip = (page - 1) * limit
    try:
        db, desde_respaldo, _ = get_db_with_fallback(tienda_key)
        total = db["ventas"].count_documents({})
        ventas = list(
            db["ventas"].find({}, {"items": 0})
            .sort("fecha", -1)
            .skip(skip)
            .limit(limit)
        )
    except ConnectionError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} y su respaldo no están disponibles")
    except ServerSelectionTimeoutError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} no disponible — sucursal fuera de línea")
    for v in ventas:
        v["_id"] = str(v["_id"])

    return {"total": total, "page": page, "limit": limit, "ventas": ventas, "desde_respaldo": desde_respaldo}


@router.get("/{tienda_key}/{venta_id}")
async def get_venta(tienda_key: str, venta_id: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    db = get_db(tienda_key)
    v = db["ventas"].find_one({"_id": ObjectId(venta_id)})
    if not v:
        raise HTTPException(404, "Venta no encontrada")
    v["_id"] = str(v["_id"])
    return v
