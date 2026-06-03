"""
Router de sincronización — Nodo 4 (réplica global) y respaldos cruzados (bkp_*).

Endpoints:
  POST /sync/nodo4            → sync manual a nodo 4
  GET  /sync/nodo4/estado     → estado del sync a nodo 4
  POST /sync/backups          → sync manual a bkp_*
  GET  /sync/backups/estado   → estado del sync a bkp_*
  POST /sync/recovery         → recovery manual (bkp_ → primario)
  GET  /sync/backups/nodo     → estado de nodo 4

El job automático corre cada SYNC_INTERVAL_MINUTES en background y:
  1. Sincroniza primarios → bkp_*
  2. Sincroniza primarios/bkp_ → nodo 4
  3. Detecta nodos que volvieron a subir y ejecuta recovery automático
"""

import threading
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from database import (
    sync_all_to_nodo4, sync_all_to_backups, recover_all_primaries,
    is_node_up, _probe_node, get_client, TIENDA_NODO, TIENDA_BACKUP_NODO,
    NODO4_DB_PREFIX,
)
from auth import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])

SYNC_INTERVAL_MINUTES = 5

# ── Estado compartido ──────────────────────────────────────────────────────
_nodo4_state: dict = {
    "ultimo_sync": None,
    "resultado": None,
    "en_progreso": False,
    "proxima_sync": None,
    "total_syncs": 0,
    "errores_consecutivos": 0,
}

_backup_state: dict = {
    "ultimo_sync": None,
    "resultado": None,
    "en_progreso": False,
    "total_syncs": 0,
    "ultimo_recovery": None,
    "nodos_recuperados": [],
}

_lock_n4  = threading.Lock()
_lock_bkp = threading.Lock()

# Seguimiento de estado previo de nodos para detectar recuperación
_prev_node_status: dict[int, bool] = {}


# ── Funciones de sync ──────────────────────────────────────────────────────

def _run_nodo4_sync():
    with _lock_n4:
        if _nodo4_state["en_progreso"]:
            return
        _nodo4_state["en_progreso"] = True
    try:
        resultado = sync_all_to_nodo4()
        now = datetime.now(timezone.utc).isoformat()
        with _lock_n4:
            _nodo4_state.update({
                "ultimo_sync": now,
                "resultado": resultado,
                "en_progreso": False,
                "total_syncs": _nodo4_state["total_syncs"] + 1,
                "errores_consecutivos": 0,
                "proxima_sync": datetime.fromtimestamp(
                    time.time() + SYNC_INTERVAL_MINUTES * 60, tz=timezone.utc
                ).isoformat(),
            })
    except Exception:
        with _lock_n4:
            _nodo4_state["en_progreso"] = False
            _nodo4_state["errores_consecutivos"] += 1


def _run_backup_sync():
    with _lock_bkp:
        if _backup_state["en_progreso"]:
            return
        _backup_state["en_progreso"] = True
    try:
        resultado = sync_all_to_backups()
        now = datetime.now(timezone.utc).isoformat()
        with _lock_bkp:
            _backup_state.update({
                "ultimo_sync": now,
                "resultado": resultado,
                "en_progreso": False,
                "total_syncs": _backup_state["total_syncs"] + 1,
            })
    except Exception:
        with _lock_bkp:
            _backup_state["en_progreso"] = False


def _check_and_recover():
    """
    Detecta nodos que volvieron a subir y ejecuta recovery automático
    (bkp_* → primario) para propagarles las escrituras que ocurrieron
    mientras estaban caídos.
    """
    global _prev_node_status
    recovered = []

    for nodo in [1, 2, 3]:
        current_up = _probe_node(nodo)
        was_up     = _prev_node_status.get(nodo, True)  # asumir UP al inicio

        if current_up and not was_up:
            # El nodo volvió a subir — recuperar desde bkp_
            recovered.append(nodo)

        _prev_node_status[nodo] = current_up

    if recovered:
        resultado = recover_all_primaries()
        now = datetime.now(timezone.utc).isoformat()
        with _lock_bkp:
            _backup_state["ultimo_recovery"] = now
            _backup_state["nodos_recuperados"] = recovered
            _backup_state["resultado_recovery"] = resultado


def _background_sync_loop():
    """Loop daemon: espera 30s al arrancar y luego corre cada SYNC_INTERVAL_MINUTES."""
    time.sleep(30)
    # Primera sincronización inicial al arrancar (puebla bkp_* con datos existentes)
    _run_backup_sync()
    _run_nodo4_sync()

    while True:
        time.sleep(SYNC_INTERVAL_MINUTES * 60)
        _check_and_recover()    # primero detectar recuperaciones
        _run_backup_sync()      # luego sync primario → bkp_
        _run_nodo4_sync()       # y sync a nodo 4


_sync_thread = threading.Thread(target=_background_sync_loop, daemon=True)
_sync_thread.start()


# ── Endpoints ─────────────────────────────────────────────────────────────

def _require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo el administrador puede gestionar sincronizaciones")
    return user


@router.post("/nodo4")
async def trigger_nodo4_sync(user: dict = Depends(_require_admin)):
    with _lock_n4:
        if _nodo4_state["en_progreso"]:
            return {"mensaje": "Sincronización a Nodo 4 ya en progreso", "en_progreso": True}
    t = threading.Thread(target=_run_nodo4_sync, daemon=True)
    t.start()
    return {"mensaje": "Sincronización a Nodo 4 iniciada", "en_progreso": True}


@router.get("/nodo4/estado")
async def get_nodo4_estado(user: dict = Depends(_require_admin)):
    with _lock_n4:
        estado = dict(_nodo4_state)
    segundos = None
    if estado.get("proxima_sync"):
        try:
            prox  = datetime.fromisoformat(estado["proxima_sync"])
            delta = (prox - datetime.now(timezone.utc)).total_seconds()
            segundos = max(0, int(delta))
        except Exception:
            pass
    return {**estado, "intervalo_minutos": SYNC_INTERVAL_MINUTES, "segundos_para_sync": segundos}


@router.post("/backups")
async def trigger_backup_sync(user: dict = Depends(_require_admin)):
    """Sincroniza todos los nodos primarios hacia sus nodos de respaldo cruzado."""
    with _lock_bkp:
        if _backup_state["en_progreso"]:
            return {"mensaje": "Sincronización de respaldos ya en progreso", "en_progreso": True}
    t = threading.Thread(target=_run_backup_sync, daemon=True)
    t.start()
    return {"mensaje": "Sincronización de respaldos cruzados iniciada", "en_progreso": True}


@router.get("/backups/estado")
async def get_backup_estado(user: dict = Depends(_require_admin)):
    with _lock_bkp:
        return dict(_backup_state)


@router.post("/recovery")
async def trigger_recovery(user: dict = Depends(_require_admin)):
    """Fuerza sincronización bkp_* → primario para nodos que ya están UP."""
    t = threading.Thread(target=lambda: recover_all_primaries(), daemon=True)
    t.start()
    return {"mensaje": "Recovery iniciado para todos los nodos primarios disponibles"}


@router.get("/nodo4/nodo")
async def get_nodo4_status(user: dict = Depends(_require_admin)):
    activo = is_node_up(4)
    bases = []
    total_docs = 0
    if activo:
        try:
            client = get_client(4)
            for tienda_key in TIENDA_NODO:
                db_name = f"{NODO4_DB_PREFIX}{tienda_key}"
                db = client[db_name]
                cols = {}
                for col in ["productos", "ventas", "clientes", "usuarios"]:
                    try:
                        c = db[col].count_documents({})
                        cols[col] = c
                        total_docs += c
                    except Exception:
                        cols[col] = 0
                bases.append({"nombre": db_name, "tienda_key": tienda_key, "colecciones": cols})
        except Exception:
            activo = False
    return {"activo": activo, "puerto": 27020, "total_bases": len(bases),
            "total_docs": total_docs, "bases": bases}
