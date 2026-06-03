from fastapi import APIRouter, Depends
from pymongo.errors import ServerSelectionTimeoutError
from database import get_central_db, get_db, TIENDAS_INFO, TIENDA_NODO, is_node_up
from auth import get_current_user

router = APIRouter(prefix="/tiendas", tags=["tiendas"])


@router.get("/")
async def get_tiendas(user: dict = Depends(get_current_user)):
    # Pre-verificar qué nodos están activos (ping rápido)
    nodos_up = {n: is_node_up(n) for n in [1, 2, 3]}

    tiendas = []
    for key, info in TIENDAS_INFO.items():
        nodo = TIENDA_NODO[key]
        base = {
            "key": key,
            "nombre": info["nombre"],
            "ciudad": info["ciudad"],
            "direccion": info["direccion"],
            "nodo": nodo,
            "nodo_activo": nodos_up.get(nodo, False),
        }
        if not nodos_up.get(nodo, False):
            tiendas.append({**base, "total_ventas": 0, "total_productos": 0, "ingresos_totales": 0})
            continue
        try:
            db = get_db(key)
            total_ventas = db["ventas"].count_documents({})
            total_productos = db["productos"].count_documents({})
            agg = list(db["ventas"].aggregate([{"$group": {"_id": None, "total": {"$sum": "$total"}}}]))
            ingresos = agg[0]["total"] if agg else 0
            tiendas.append({**base, "total_ventas": total_ventas, "total_productos": total_productos, "ingresos_totales": round(ingresos, 2)})
        except Exception:
            tiendas.append({**base, "total_ventas": 0, "total_productos": 0, "ingresos_totales": 0, "nodo_activo": False})
    return tiendas


@router.get("/{tienda_key}")
async def get_tienda(tienda_key: str, user: dict = Depends(get_current_user)):
    if tienda_key not in TIENDAS_INFO:
        from fastapi import HTTPException
        raise HTTPException(404, "Tienda no encontrada")

    # Verificar acceso: cajero/gerente solo ve su tienda
    if user["role"] not in ("admin", "supervisor") and user.get("tienda") != tienda_key:
        from fastapi import HTTPException
        raise HTTPException(403, "Sin acceso a esta tienda")

    db = get_db(tienda_key)
    info = TIENDAS_INFO[tienda_key]

    ventas_agg = list(db["ventas"].aggregate([
        {"$group": {
            "_id": None,
            "total_ingresos": {"$sum": "$total"},
            "total_ventas": {"$sum": 1},
            "promedio_venta": {"$avg": "$total"},
        }}
    ]))

    stats = ventas_agg[0] if ventas_agg else {}

    return {
        "key": tienda_key,
        **info,
        "nodo": TIENDA_NODO[tienda_key],
        "total_ventas": stats.get("total_ventas", 0),
        "total_ingresos": round(stats.get("total_ingresos", 0), 2),
        "promedio_venta": round(stats.get("promedio_venta", 0), 2),
        "total_productos": db["productos"].count_documents({}),
        "total_clientes": db["clientes"].count_documents({}),
    }
