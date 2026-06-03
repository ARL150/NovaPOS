from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from pymongo.errors import ServerSelectionTimeoutError
from database import get_db, get_db_with_fallback, get_all_dbs_safe, get_all_dbs_safe_with_fallback, TIENDAS_INFO, TIENDA_NODO
from auth import get_current_user

router = APIRouter(prefix="/reportes", tags=["reportes"])


@router.get("/resumen-global")
async def resumen_global(user: dict = Depends(get_current_user)):
    """Agrega estadísticas de todos los nodos disponibles."""
    resultado = []
    for tienda_key, db, desde_respaldo in get_all_dbs_safe_with_fallback():
        try:
            agg = list(db["ventas"].aggregate([
                {"$group": {
                    "_id": None,
                    "total_ventas": {"$sum": 1},
                    "total_ingresos": {"$sum": "$total"},
                    "promedio": {"$avg": "$total"},
                }}
            ]))
            stats = agg[0] if agg else {}
            resultado.append({
                "tienda_key": tienda_key,
                "tienda_nombre": TIENDAS_INFO[tienda_key]["nombre"],
                "nodo": TIENDA_NODO.get(tienda_key, 0),
                "total_ventas": stats.get("total_ventas", 0),
                "total_ingresos": round(stats.get("total_ingresos", 0), 2),
                "promedio_venta": round(stats.get("promedio", 0), 2),
                "nodo_activo": True,
                "desde_respaldo": desde_respaldo,
            })
        except Exception:
            resultado.append({
                "tienda_key": tienda_key,
                "tienda_nombre": TIENDAS_INFO[tienda_key]["nombre"],
                "nodo": TIENDA_NODO.get(tienda_key, 0),
                "total_ventas": 0, "total_ingresos": 0, "promedio_venta": 0,
                "nodo_activo": False,
                "desde_respaldo": False,
            })
    return resultado


@router.get("/ventas-por-dia/{tienda_key}")
async def ventas_por_dia(tienda_key: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, desde_respaldo, _ = get_db_with_fallback(tienda_key)
    except ConnectionError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} y su respaldo no disponibles")

    pipeline = [
        {"$addFields": {"fecha_dt": {"$dateFromString": {"dateString": "$fecha"}}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_dt"}},
            "ventas": {"$sum": 1},
            "ingresos": {"$sum": "$total"},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 30},
    ]
    try:
        data = list(db["ventas"].aggregate(pipeline))
    except ServerSelectionTimeoutError:
        nodo = TIENDA_NODO.get(tienda_key, 0)
        raise HTTPException(503, detail=f"Nodo {nodo} no disponible")
    return [{"fecha": d["_id"], "ventas": d["ventas"], "ingresos": round(d["ingresos"], 2), "desde_respaldo": desde_respaldo} for d in data]


@router.get("/ventas-por-dia-global")
async def ventas_por_dia_global(user: dict = Depends(get_current_user)):
    """Suma de ingresos diarios de todos los nodos (con fallback a respaldo y nodo4)."""
    from collections import defaultdict
    acum: dict = defaultdict(lambda: {"ventas": 0, "ingresos": 0.0})
    nodos_caidos: list = []
    nodos_respaldo: list = []

    for tienda_key, db, desde_respaldo in get_all_dbs_safe_with_fallback():
        try:
            pipeline = [
                {"$addFields": {"fecha_dt": {"$dateFromString": {"dateString": "$fecha"}}}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_dt"}},
                    "ventas": {"$sum": 1},
                    "ingresos": {"$sum": "$total"},
                }},
                {"$sort": {"_id": 1}},
            ]
            for d in db["ventas"].aggregate(pipeline):
                acum[d["_id"]]["ventas"] += d["ventas"]
                acum[d["_id"]]["ingresos"] += d["ingresos"]
            if desde_respaldo:
                n = TIENDA_NODO.get(tienda_key, 0)
                if n not in nodos_respaldo:
                    nodos_respaldo.append(n)
        except Exception:
            n = TIENDA_NODO.get(tienda_key, 0)
            if n not in nodos_caidos:
                nodos_caidos.append(n)

    resultado = sorted(
        [{"fecha": k, "ventas": v["ventas"], "ingresos": round(v["ingresos"], 2)} for k, v in acum.items()],
        key=lambda x: x["fecha"]
    )
    return {"data": resultado[-30:], "nodos_caidos": nodos_caidos, "nodos_respaldo": nodos_respaldo}


@router.get("/productos-mas-vendidos/{tienda_key}")
async def productos_mas_vendidos(tienda_key: str, limit: int = 10, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo y su respaldo no disponibles")

    pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.nombre",
            "cantidad_total": {"$sum": "$items.cantidad"},
            "ingresos": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"cantidad_total": -1}},
        {"$limit": limit},
    ]
    data = list(db["ventas"].aggregate(pipeline))
    return [{"producto": d["_id"], "cantidad": d["cantidad_total"], "ingresos": round(d["ingresos"], 2)} for d in data]


@router.get("/metodos-pago/{tienda_key}")
async def metodos_pago(tienda_key: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo y su respaldo no disponibles")

    pipeline = [
        {"$group": {"_id": "$metodo_pago", "total": {"$sum": 1}, "monto": {"$sum": "$total"}}},
        {"$sort": {"total": -1}},
    ]
    return list(db["ventas"].aggregate(pipeline))


@router.get("/comparativo-tiendas")
async def comparativo_tiendas(user: dict = Depends(get_current_user)):
    """Comparativo de ingresos entre las tiendas (multi-nodo, con fallback)."""
    resultado = []
    for tienda_key, db, desde_respaldo in get_all_dbs_safe_with_fallback():
        try:
            meses = list(db["ventas"].aggregate([
                {"$addFields": {"fecha_dt": {"$dateFromString": {"dateString": "$fecha"}}}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m", "date": "$fecha_dt"}},
                    "ingresos": {"$sum": "$total"},
                    "ventas": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
                {"$limit": 6},
            ]))
            resultado.append({
                "tienda": TIENDAS_INFO[tienda_key]["nombre"],
                "tienda_key": tienda_key,
                "meses": [{"mes": m["_id"], "ingresos": round(m["ingresos"], 2), "ventas": m["ventas"]} for m in meses],
            })
        except Exception:
            continue
    return resultado


@router.get("/inventario-bajo/{tienda_key}")
async def inventario_bajo(tienda_key: str, umbral: int = 10, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        raise HTTPException(404, "Tienda no encontrada")
    try:
        db, _, _ = get_db_with_fallback(tienda_key)
    except ConnectionError:
        raise HTTPException(503, "Nodo y su respaldo no disponibles")
    productos = list(db["productos"].find({"stock": {"$lte": umbral}}, {"_id": 0}).sort("stock", 1).limit(50))
    return productos
