from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth_routes, stores_routes, sales_routes, reports_routes, products_routes, users_routes, explorer_routes, clients_routes, sync_routes

app = FastAPI(
    title="OXXO BDD — Sistema Distribuido de Ventas",
    description="API para sistema distribuido de ventas tipo OXXO. UAA BDD 2026.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(stores_routes.router)
app.include_router(sales_routes.router)
app.include_router(reports_routes.router)
app.include_router(products_routes.router)
app.include_router(users_routes.router)
app.include_router(explorer_routes.router)
app.include_router(clients_routes.router)
app.include_router(sync_routes.router)


@app.get("/")
def root():
    return {"sistema": "OXXO BDD Distribuido", "version": "1.0.0", "status": "OK"}


@app.get("/health")
def health():
    from database import get_client, TIENDA_NODO, is_node_up, _probe_node
    import concurrent.futures

    nodos: dict = {}
    tiendas_por_nodo: dict = {1: [], 2: [], 3: []}

    for tienda_key, nodo in TIENDA_NODO.items():
        tiendas_por_nodo[nodo].append(tienda_key)

    # Probar todos los nodos en paralelo para que /health sea rápido
    def check(n):
        try:
            get_client(n).admin.command("ping")
            return n, "OK"
        except Exception as e:
            return n, f"ERROR: {e}"

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(check, n): n for n in [1, 2, 3, 4]}
        for f in concurrent.futures.as_completed(futures):
            n, status = f.result()
            nodos[f"nodo{n}"] = status

    return {
        "nodos": nodos,
        "tiendas_por_nodo": tiendas_por_nodo,
    }
