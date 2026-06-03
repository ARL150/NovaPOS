"""
Script de seed: pobla cada nodo MongoDB con datos masivos.
Genera 200+ registros por colección en cada una de las 10 tiendas.
"""
import random
from datetime import datetime, timedelta, timezone
from faker import Faker
from database import get_db, get_central_db, TIENDAS_INFO, TIENDA_NODO
from auth import hash_password

fake = Faker("es_MX")
random.seed(42)

CATEGORIAS = ["Bebidas", "Snacks", "Lácteos", "Panadería", "Dulces", "Tabaco",
              "Higiene", "Limpieza", "Congelados", "Botanas", "Bebidas Calientes", "Alcohol"]

PRODUCTOS_BASE = [
    ("Coca-Cola 600ml", "Bebidas", 22.0),
    ("Pepsi 600ml", "Bebidas", 20.0),
    ("Agua Bonafont 1L", "Bebidas", 14.0),
    ("Gatorade Limón", "Bebidas", 28.0),
    ("Red Bull 250ml", "Bebidas", 35.0),
    ("Monster Energy", "Bebidas", 38.0),
    ("Jumex Mango 1L", "Bebidas", 18.0),
    ("Leche Lala 1L", "Lácteos", 25.0),
    ("Yogurt Activia", "Lácteos", 22.0),
    ("Queso Manchego 200g", "Lácteos", 45.0),
    ("Crema Lala 200g", "Lácteos", 18.0),
    ("Mantequilla 90g", "Lácteos", 20.0),
    ("Sabritas Sal 45g", "Snacks", 16.0),
    ("Doritos Nacho 55g", "Snacks", 18.0),
    ("Ruffles Queso 45g", "Snacks", 16.0),
    ("Cheetos Torcidos 45g", "Snacks", 16.0),
    ("Takis Fuego 62g", "Snacks", 18.0),
    ("Palomitas Act II", "Snacks", 22.0),
    ("Bimbo Pan Blanco", "Panadería", 35.0),
    ("Marinela Gansito", "Panadería", 14.0),
    ("Submarino Chocolate", "Panadería", 12.0),
    ("Pingüinos 2pk", "Panadería", 18.0),
    ("Twinkies", "Panadería", 16.0),
    ("Skittles 61g", "Dulces", 20.0),
    ("M&M's Maní", "Dulces", 25.0),
    ("Snickers", "Dulces", 20.0),
    ("Kit Kat", "Dulces", 20.0),
    ("Chicles Trident", "Dulces", 12.0),
    ("Caramelos Halls", "Dulces", 14.0),
    ("Cigarro Marlboro", "Tabaco", 65.0),
    ("Cigarro Camel", "Tabaco", 60.0),
    ("Shampoo Pantene 400ml", "Higiene", 78.0),
    ("Jabón Dove 90g", "Higiene", 28.0),
    ("Desodorante Old Spice", "Higiene", 65.0),
    ("Pasta Colgate 75ml", "Higiene", 30.0),
    ("Cloro 1L", "Limpieza", 22.0),
    ("Detergente Ariel 500g", "Limpieza", 45.0),
    ("Suavitel 500ml", "Limpieza", 32.0),
    ("Fabuloso 1L", "Limpieza", 28.0),
    ("Helado Magnum", "Congelados", 38.0),
    ("Paleta Nestlé", "Congelados", 18.0),
    ("Café Nescafé 100g", "Bebidas Calientes", 55.0),
    ("Capuchino 3en1", "Bebidas Calientes", 18.0),
    ("Té Lipton 25 sobres", "Bebidas Calientes", 35.0),
    ("Cerveza Corona 355ml", "Alcohol", 28.0),
    ("Cerveza Modelo 355ml", "Alcohol", 30.0),
    ("Cerveza Heineken 355ml", "Alcohol", 35.0),
    ("Vodka Smirnoff 200ml", "Alcohol", 95.0),
    ("Jugo Del Valle 1L", "Bebidas", 22.0),
    ("Tortillas Misión 10pk", "Panadería", 28.0),
    ("Galletas Oreo 133g", "Dulces", 30.0),
]

METODOS_PAGO = ["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia", "vales"]
METODO_PESOS = [0.50, 0.25, 0.15, 0.07, 0.03]

PROVEEDORES = ["Bimbo", "Lala", "PepsiCo", "Coca-Cola FEMSA", "Nestlé México",
               "Sabritas", "Grupo Jumex", "Philip Morris", "Procter & Gamble", "Unilever"]


def make_productos(tienda_key: str, count: int = 220):
    productos = []
    for nombre, cat, precio in PRODUCTOS_BASE:
        variacion = random.uniform(0.95, 1.05)
        productos.append({
            "nombre": nombre,
            "categoria": cat,
            "precio": round(precio * variacion, 2),
            "stock": random.randint(5, 200),
            "codigo_barras": str(random.randint(1000000000000, 9999999999999)),
            "proveedor": random.choice(PROVEEDORES),
            "tienda_key": tienda_key,
        })

    # Completar hasta llegar a count
    while len(productos) < count:
        cat = random.choice(CATEGORIAS)
        productos.append({
            "nombre": f"{fake.word().capitalize()} {cat} {fake.numerify('##')}",
            "categoria": cat,
            "precio": round(random.uniform(8.0, 150.0), 2),
            "stock": random.randint(0, 300),
            "codigo_barras": str(random.randint(1000000000000, 9999999999999)),
            "proveedor": random.choice(PROVEEDORES),
            "tienda_key": tienda_key,
        })
    return productos


def make_clientes(count: int = 250):
    clientes = []
    for _ in range(count):
        clientes.append({
            "nombre": fake.name(),
            "email": fake.email(),
            "telefono": fake.phone_number(),
            "ciudad": "Aguascalientes",
            "rfc": fake.bothify("???######???#").upper(),
            "fecha_registro": fake.date_time_this_year().isoformat(),
        })
    return clientes


def make_ventas(productos_ids: list, count: int = 300):
    ventas = []
    now = datetime.now(timezone.utc)
    for i in range(count):
        fecha = now - timedelta(days=random.randint(0, 180), hours=random.randint(0, 23))
        n_items = random.randint(1, 5)
        selected = random.sample(productos_ids, min(n_items, len(productos_ids)))
        items = []
        subtotal = 0.0
        for prod in selected:
            cant = random.randint(1, 4)
            precio = prod["precio"]
            sub = round(cant * precio, 2)
            subtotal += sub
            items.append({
                "producto_id": str(prod["_id"]),
                "nombre": prod["nombre"],
                "cantidad": cant,
                "precio_unitario": precio,
                "subtotal": sub,
            })
        iva = round(subtotal * 0.16, 2)
        total = round(subtotal + iva, 2)
        metodo = random.choices(METODOS_PAGO, weights=METODO_PESOS)[0]
        ventas.append({
            "cajero": random.choice(["cajero1", "cajero2", "cajero3"]),
            "cliente_nombre": random.choice([fake.name(), "Cliente General", "Cliente General"]),
            "items": items,
            "subtotal": round(subtotal, 2),
            "iva": iva,
            "total": total,
            "metodo_pago": metodo,
            "fecha": fecha.isoformat(),
        })
    return ventas


def seed_tienda(tienda_key: str):
    db = get_db(tienda_key)
    print(f"  [{tienda_key}] Limpiando colecciones...")
    db["productos"].drop()
    db["clientes"].drop()
    db["ventas"].drop()
    db["usuarios"].drop()

    print(f"  [{tienda_key}] Insertando productos...")
    productos = make_productos(tienda_key, 220)
    result = db["productos"].insert_many(productos)
    productos_con_ids = [{"_id": oid, **p} for oid, p in zip(result.inserted_ids, productos)]

    print(f"  [{tienda_key}] Insertando clientes...")
    db["clientes"].insert_many(make_clientes(250))

    print(f"  [{tienda_key}] Insertando ventas...")
    db["ventas"].insert_many(make_ventas(productos_con_ids, 300))

    # Usuarios de la tienda
    db["usuarios"].insert_many([
        {
            "username": f"gerente_{tienda_key}",
            "password": hash_password("gerente123"), "password_plain": "gerente123",
            "role": "gerente",
            "nombre": f"Gerente {tienda_key.replace('tienda_', '').title()}",
            "tienda": tienda_key,
        },
        {
            "username": f"cajero1_{tienda_key}",
            "password": hash_password("cajero123"), "password_plain": "cajero123",
            "role": "cajero",
            "nombre": f"Cajero 1 {tienda_key.replace('tienda_', '').title()}",
            "tienda": tienda_key,
        },
        {
            "username": f"cajero2_{tienda_key}",
            "password": hash_password("cajero123"), "password_plain": "cajero123",
            "role": "cajero",
            "nombre": f"Cajero 2 {tienda_key.replace('tienda_', '').title()}",
            "tienda": tienda_key,
        },
    ])

    # Índices para consultas rápidas
    db["ventas"].create_index("fecha")
    db["ventas"].create_index("cajero")
    db["productos"].create_index("categoria")
    db["productos"].create_index("nombre")
    print(f"  [{tienda_key}] ✓ listo")


def seed_central():
    db = get_central_db()
    db["usuarios"].drop()
    db["usuarios"].insert_many([
        {
            "username": "admin",
            "password": hash_password("admin2026"), "password_plain": "admin2026",
            "role": "admin",
            "nombre": "Administrador Global",
            "tienda": None,
        },
        {
            "username": "supervisor",
            "password": hash_password("super2026"), "password_plain": "super2026",
            "role": "supervisor",
            "nombre": "Supervisor Regional",
            "tienda": None,
        },
    ])
    print("  [central] ✓ usuarios admin creados")


if __name__ == "__main__":
    print("=== SEED: Sistema OXXO BDD Distribuido ===\n")
    print("Poblando BD central (nodo 1)...")
    seed_central()

    for tienda_key in TIENDAS_INFO:
        nodo = TIENDA_NODO[tienda_key]
        print(f"\nPoblando {tienda_key} → nodo {nodo}...")
        seed_tienda(tienda_key)

    print("\n✅ Seed completado exitosamente.")
    print("\nUsuarios de acceso:")
    print("  admin / admin2026  (admin global)")
    print("  supervisor / super2026  (admin global)")
    print("  gerente_tienda_centro / gerente123")
    print("  cajero1_tienda_centro / cajero123")
    print("  (mismo patrón para el resto de tiendas)")
