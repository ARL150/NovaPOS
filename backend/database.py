"""
Capa de distribución de datos.
Cada tienda tiene su propia base de datos en un nodo MongoDB distinto,
emulando una arquitectura distribuida con particionamiento horizontal.

Distribución de nodos:
  Nodo 1 (puerto 27017): Tiendas 1-2   → tienda_centro, tienda_norte
  Nodo 2 (puerto 27018): Tiendas 3-5   → tienda_sur, tienda_este, tienda_oeste
  Nodo 3 (puerto 27019): Tiendas 6-10  → tienda_universidad, tienda_insurgentes,
                                          tienda_tecnologico, tienda_alameda, tienda_jardines
"""

from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
import time
import threading

MONGO_USER = "admin"
MONGO_PASS = "oxxo2026"

NODE_URIS = {
    1: f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27017",
    2: f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27018",
    3: f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27019",
    4: f"mongodb://{MONGO_USER}:{MONGO_PASS}@localhost:27020",  # Nodo 4: réplica global
}

# Nodo 4 almacena copias de TODAS las tiendas con prefijo "global_"
NODO4_DB_PREFIX = "global_"

# Mapa de tienda → nodo
TIENDA_NODO: dict[str, int] = {
    "tienda_centro":       1,
    "tienda_norte":        1,
    "tienda_sur":          2,
    "tienda_este":         2,
    "tienda_oeste":        2,
    "tienda_universidad":  3,
    "tienda_insurgentes":  3,
    "tienda_tecnologico":  3,
    "tienda_alameda":      3,
    "tienda_jardines":     3,
}

TIENDAS_INFO = {
    "tienda_centro":       {"nombre": "OXXO Centro",        "ciudad": "Aguascalientes", "direccion": "Av. López Mateos 100"},
    "tienda_norte":        {"nombre": "OXXO Norte",         "ciudad": "Aguascalientes", "direccion": "Blvd. Luis Donaldo Colosio 450"},
    "tienda_sur":          {"nombre": "OXXO Sur",           "ciudad": "Aguascalientes", "direccion": "Av. De la Convención 200"},
    "tienda_este":         {"nombre": "OXXO Este",          "ciudad": "Aguascalientes", "direccion": "Av. Siglo XXI 340"},
    "tienda_oeste":        {"nombre": "OXXO Oeste",         "ciudad": "Aguascalientes", "direccion": "Blvd. Adolfo López Mateos 780"},
    "tienda_universidad":  {"nombre": "OXXO Universidad",   "ciudad": "Aguascalientes", "direccion": "Av. Universidad 900"},
    "tienda_insurgentes":  {"nombre": "OXXO Insurgentes",   "ciudad": "Aguascalientes", "direccion": "Av. Insurgentes 1200"},
    "tienda_tecnologico":  {"nombre": "OXXO Tecnológico",   "ciudad": "Aguascalientes", "direccion": "Av. Tecnológico 560"},
    "tienda_alameda":      {"nombre": "OXXO Alameda",       "ciudad": "Aguascalientes", "direccion": "Jardín de la Alameda 30"},
    "tienda_jardines":     {"nombre": "OXXO Jardines",      "ciudad": "Aguascalientes", "direccion": "Av. Jardines 1500"},
}

_clients: dict[int, MongoClient] = {}

# ── Caché de salud de nodos ──────────────────────────────────────────────────
# Evita re-probar nodos caídos en cada request. TTL = 5 segundos.
# Si un nodo falló hace menos de 5s, se asume caído sin esperar el timeout.
_node_health: dict[int, bool]  = {}   # True = UP, False = DOWN
_node_health_ts: dict[int, float] = {}  # timestamp del último check
_health_lock = threading.Lock()
NODE_HEALTH_TTL = 5.0   # segundos antes de volver a probar un nodo caído
NODE_UP_TTL     = 10.0  # segundos antes de re-confirmar que un nodo sigue vivo


def get_client(nodo: int) -> MongoClient:
    if nodo not in _clients:
        _clients[nodo] = MongoClient(
            NODE_URIS[nodo],
            serverSelectionTimeoutMS=400,  # falla rápido (0.4s por intento)
            connectTimeoutMS=400,
            socketTimeoutMS=2000,          # queries lentas sí les damos tiempo
            heartbeatFrequencyMS=5000,
        )
    return _clients[nodo]


def _probe_node(nodo: int) -> bool:
    """Prueba un nodo y actualiza la caché. Thread-safe."""
    try:
        get_client(nodo).admin.command("ping")
        result = True
    except Exception:
        result = False
    with _health_lock:
        _node_health[nodo] = result
        _node_health_ts[nodo] = time.monotonic()
    return result


def is_node_up(nodo: int) -> bool:
    """Devuelve el estado del nodo usando caché para evitar timeouts repetidos."""
    now = time.monotonic()
    with _health_lock:
        cached = _node_health.get(nodo)
        ts     = _node_health_ts.get(nodo, 0.0)
        age    = now - ts

    if cached is None:
        # Primera vez — probe real
        return _probe_node(nodo)
    if cached is False and age < NODE_HEALTH_TTL:
        # Sabemos que está caído y aún no ha pasado el TTL — no esperar
        return False
    if cached is True and age < NODE_UP_TTL:
        # Sabemos que está vivo y no ha pasado el TTL — confiar
        return True
    # TTL expirado — re-probar en background para no bloquear, usar valor previo
    t = threading.Thread(target=_probe_node, args=(nodo,), daemon=True)
    t.start()
    return cached  # devuelve el valor previo mientras se re-prueba


def invalidate_node_cache(nodo: int) -> None:
    """Fuerza re-prueba del nodo en la próxima llamada (útil tras error de operación)."""
    with _health_lock:
        _node_health_ts[nodo] = 0.0


def get_db(tienda_key: str):
    """Retorna la base de datos del nodo que corresponde a la tienda."""
    nodo = TIENDA_NODO.get(tienda_key)
    if nodo is None:
        raise ValueError(f"Tienda desconocida: {tienda_key}")
    client = get_client(nodo)
    return client[tienda_key]


def get_central_db():
    """BD central en nodo 1 para datos globales (tiendas, admins)."""
    return get_client(1)["oxxo_central"]


def get_all_dbs():
    """Iterador de todas las bases de datos de tiendas."""
    for tienda_key in TIENDA_NODO:
        yield tienda_key, get_db(tienda_key)


def get_all_dbs_safe():
    """Iterador tolerante a fallos: omite tiendas cuyo nodo no responde (usa caché)."""
    for tienda_key, nodo in TIENDA_NODO.items():
        if not is_node_up(nodo):
            continue
        try:
            db = get_db(tienda_key)
            db.list_collection_names()
            yield tienda_key, db
        except Exception:
            invalidate_node_cache(nodo)
            continue


# ── Replicación cross-nodo ────────────────────────────────────────────────────
# Cada tienda tiene un nodo primario y un nodo de respaldo.
# Si el primario cae, las lecturas se sirven desde el respaldo.
# Cada escritura se intenta en primario Y respaldo (el respaldo falla silencioso).

TIENDA_BACKUP_NODO: dict[str, int] = {
    # Nodo 1 → respaldado en Nodo 2
    "tienda_centro":       2,
    "tienda_norte":        2,
    # Nodo 2 → respaldado en Nodo 3
    "tienda_sur":          3,
    "tienda_este":         3,
    "tienda_oeste":        3,
    # Nodo 3 → respaldado en Nodo 1
    "tienda_universidad":  1,
    "tienda_insurgentes":  1,
    "tienda_tecnologico":  1,
    "tienda_alameda":      1,
    "tienda_jardines":     1,
}


def get_backup_db(tienda_key: str):
    """Retorna la base de datos de respaldo (en otro nodo)."""
    backup_nodo = TIENDA_BACKUP_NODO.get(tienda_key)
    if backup_nodo is None:
        return None
    client = get_client(backup_nodo)
    return client[f"bkp_{tienda_key}"]


def get_nodo4_db(tienda_key: str):
    """Retorna la base de datos de este tienda en el Nodo 4 (réplica global)."""
    client = get_client(4)
    return client[f"{NODO4_DB_PREFIX}{tienda_key}"]


def get_db_with_fallback(tienda_key: str) -> tuple:
    """
    Cadena de fallback con caché de salud para respuesta rápida:
      1. Nodo primario de la tienda  (si la caché dice que está UP)
      2. Nodo de respaldo cruzado   (bkp_*)
      3. Nodo 4 — réplica global    (global_*)
    Retorna (db, desde_respaldo: bool, nivel: int)
      nivel 0 = primario, 1 = respaldo cruzado, 2 = nodo4
    """
    primary_nodo = TIENDA_NODO.get(tienda_key)

    # 1. Primario — solo intentar si la caché dice que está UP (o primera vez)
    if primary_nodo is not None and is_node_up(primary_nodo):
        try:
            db = get_db(tienda_key)
            db.list_collection_names()
            return db, False, 0
        except Exception:
            # Marcarlo como caído para las próximas requests
            invalidate_node_cache(primary_nodo)
            _probe_node(primary_nodo)  # actualizar caché ahora

    # 2. Respaldo cruzado
    backup_nodo = TIENDA_BACKUP_NODO.get(tienda_key)
    if backup_nodo is not None and is_node_up(backup_nodo):
        backup = get_backup_db(tienda_key)
        if backup is not None:
            try:
                backup.list_collection_names()
                return backup, True, 1
            except Exception:
                invalidate_node_cache(backup_nodo)
                _probe_node(backup_nodo)

    # 3. Nodo 4 — réplica global (último recurso)
    if is_node_up(4):
        try:
            n4 = get_nodo4_db(tienda_key)
            n4.list_collection_names()
            return n4, True, 2
        except Exception:
            invalidate_node_cache(4)
            _probe_node(4)

    raise ConnectionError(f"Nodo primario, respaldo y Nodo 4 de '{tienda_key}' no disponibles")


def replicate_insert(tienda_key: str, collection: str, doc: dict, skip_level: int = 0) -> None:
    """
    Inserta doc en niveles de respaldo superiores al nivel actual.
    skip_level: 0 = replicar a bkp_ y nodo4
                1 = ya estamos en bkp_, solo replicar a nodo4
                2 = ya estamos en nodo4, no replicar más
    """
    if skip_level <= 0:
        try:
            bkp = get_backup_db(tienda_key)
            if bkp is not None:
                bkp[collection].replace_one({"_id": doc["_id"]}, doc.copy(), upsert=True)
        except Exception:
            pass
    if skip_level <= 1:
        try:
            get_nodo4_db(tienda_key)[collection].replace_one({"_id": doc["_id"]}, doc.copy(), upsert=True)
        except Exception:
            pass


def replicate_update(tienda_key: str, collection: str, filtro: dict, update: dict, skip_level: int = 0) -> None:
    """Aplica update en niveles de respaldo superiores al nivel actual."""
    if skip_level <= 0:
        try:
            bkp = get_backup_db(tienda_key)
            if bkp is not None:
                bkp[collection].update_one(filtro, update)
        except Exception:
            pass
    if skip_level <= 1:
        try:
            get_nodo4_db(tienda_key)[collection].update_one(filtro, update)
        except Exception:
            pass


def replicate_insert_many(tienda_key: str, collection: str, docs: list) -> None:
    """Inserta múltiples docs en respaldo cruzado Y en Nodo 4. Falla silencioso."""
    try:
        bkp = get_backup_db(tienda_key)
        if bkp is not None and docs:
            bkp[collection].insert_many([d.copy() for d in docs])
    except Exception:
        pass
    try:
        if docs:
            get_nodo4_db(tienda_key)[collection].insert_many([d.copy() for d in docs])
    except Exception:
        pass


def get_all_dbs_safe_with_fallback():
    """
    Iterador tolerante a fallos con cadena de respaldo (primario → cruzado → nodo4).
    Yields (tienda_key, db, desde_respaldo).
    """
    for tienda_key in TIENDA_NODO:
        try:
            db, desde_respaldo, _ = get_db_with_fallback(tienda_key)
            yield tienda_key, db, desde_respaldo
        except Exception:
            continue


# ── Sincronización completa hacia el Nodo 4 ─────────────────────────────────

COLLECTIONS_SYNC = ["productos", "ventas", "clientes", "usuarios"]


def sync_tienda_to_nodo4(tienda_key: str) -> dict:
    """
    Copia TODOS los documentos de una tienda al Nodo 4.
    Usa upsert por _id para no duplicar.
    Retorna estadísticas de la sincronización.
    """
    from datetime import datetime, timezone
    stats = {"tienda_key": tienda_key, "colecciones": {}, "error": None}
    try:
        # Origen: primario o respaldo cruzado (no el nodo4 mismo)
        try:
            src = get_db(tienda_key)
            src.list_collection_names()
        except Exception:
            src = get_backup_db(tienda_key)
            if src is None:
                raise ConnectionError("Sin origen disponible")
            src.list_collection_names()

        dst = get_nodo4_db(tienda_key)

        for col in COLLECTIONS_SYNC:
            docs = list(src[col].find({}))
            upserted = 0
            for doc in docs:
                dst[col].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                upserted += 1
            stats["colecciones"][col] = upserted

        stats["sincronizado_en"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        stats["error"] = str(e)

    return stats


def sync_all_to_nodo4() -> dict:
    """Sincroniza todas las tiendas + BD central al Nodo 4."""
    from datetime import datetime, timezone
    resultados = {}
    for tienda_key in TIENDA_NODO:
        resultados[tienda_key] = sync_tienda_to_nodo4(tienda_key)

    # También sincronizar BD central (oxxo_central → nodo 1 → nodo 4)
    try:
        src_central = get_central_db()
        dst_central = get_client(4)["global_oxxo_central"]
        for col in ["usuarios", "tiendas"]:
            try:
                docs = list(src_central[col].find({}))
                for doc in docs:
                    dst_central[col].replace_one({"_id": doc["_id"]}, doc, upsert=True)
            except Exception:
                pass
        resultados["oxxo_central"] = {"sincronizado_en": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        resultados["oxxo_central"] = {"error": str(e)}

    return {
        "completado_en": datetime.now(timezone.utc).isoformat(),
        "tiendas": resultados,
    }


# ── Sincronización hacia nodos de respaldo cruzado (bkp_*) ──────────────────

def sync_tienda_to_backup(tienda_key: str) -> dict:
    """
    Copia TODOS los documentos del nodo primario al nodo de respaldo cruzado (bkp_*).
    Solo funciona si AMBOS nodos están UP.
    """
    from datetime import datetime, timezone
    stats = {"tienda_key": tienda_key, "colecciones": {}, "error": None}

    primary_nodo = TIENDA_NODO.get(tienda_key)
    if primary_nodo is None:
        stats["error"] = "Tienda desconocida"
        return stats

    if not is_node_up(primary_nodo):
        stats["error"] = f"Nodo primario {primary_nodo} no disponible"
        return stats

    backup_nodo = TIENDA_BACKUP_NODO.get(tienda_key)
    if backup_nodo is None:
        stats["error"] = "Sin nodo de respaldo configurado"
        return stats

    if not is_node_up(backup_nodo):
        stats["error"] = f"Nodo de respaldo {backup_nodo} no disponible"
        return stats

    src_db  = get_db(tienda_key)
    bkp_db  = get_backup_db(tienda_key)

    for col in COLLECTIONS_SYNC:
        upserted = 0
        try:
            docs = list(src_db[col].find({}))
            for doc in docs:
                bkp_db[col].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                upserted += 1
            stats["colecciones"][col] = upserted
        except Exception as e:
            stats["colecciones"][col] = {"error": str(e)}

    stats["sincronizado_en"] = datetime.now(timezone.utc).isoformat()
    return stats


def sync_all_to_backups() -> dict:
    """Sincroniza todas las tiendas a sus nodos de respaldo cruzado."""
    from datetime import datetime, timezone
    resultados = {}
    for tienda_key in TIENDA_NODO:
        resultados[tienda_key] = sync_tienda_to_backup(tienda_key)
    return {
        "completado_en": datetime.now(timezone.utc).isoformat(),
        "tiendas": resultados,
    }


# ── Recuperación: cuando un nodo primario vuelve a subir ────────────────────

def recover_primary_from_backup(tienda_key: str) -> dict:
    """
    Sincroniza datos de bkp_* al nodo primario tras recuperación.
    Garantiza que las escrituras hechas en bkp_ mientras el primario estaba
    caído se propaguen de vuelta al nodo primario.
    """
    from datetime import datetime, timezone
    stats = {"tienda_key": tienda_key, "colecciones": {}, "error": None}

    primary_nodo = TIENDA_NODO.get(tienda_key)
    backup_nodo  = TIENDA_BACKUP_NODO.get(tienda_key)

    if not is_node_up(primary_nodo):
        stats["error"] = f"Nodo primario {primary_nodo} aún no disponible"
        return stats

    if backup_nodo is None or not is_node_up(backup_nodo):
        stats["error"] = "Nodo de respaldo no disponible para recovery"
        return stats

    bkp_db = get_backup_db(tienda_key)   # source: bkp_
    pri_db = get_db(tienda_key)          # dest:   primario

    for col in COLLECTIONS_SYNC:
        upserted = 0
        try:
            docs = list(bkp_db[col].find({}))
            for doc in docs:
                pri_db[col].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                upserted += 1
            stats["colecciones"][col] = upserted
        except Exception as e:
            stats["colecciones"][col] = {"error": str(e)}

    stats["recuperado_en"] = datetime.now(timezone.utc).isoformat()
    return stats


def recover_all_primaries() -> dict:
    """Intenta recuperar todos los nodos primarios desde sus respaldos."""
    from datetime import datetime, timezone
    resultados = {}
    for tienda_key, primary_nodo in TIENDA_NODO.items():
        if is_node_up(primary_nodo):
            resultados[tienda_key] = recover_primary_from_backup(tienda_key)
    return {
        "completado_en": datetime.now(timezone.utc).isoformat(),
        "tiendas": resultados,
    }
