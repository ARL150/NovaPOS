# NovaPOS — Sistema Distribuido de Ventas

> Proyecto Final · Bases de Datos Distribuidas · 8°B · UAA 2026

Sistema de punto de venta distribuido que emula la operación de una cadena de tiendas tipo OXXO con **10 sucursales**, **4 nodos MongoDB**, replicación cruzada automática y alta disponibilidad.

---

## Índice

1. [Descripción del proyecto](#descripción-del-proyecto)
2. [Arquitectura del sistema](#arquitectura-del-sistema)
3. [Distribución de datos (Fragmentación)](#distribución-de-datos-fragmentación)
4. [Replicación y alta disponibilidad](#replicación-y-alta-disponibilidad)
5. [Stack tecnológico](#stack-tecnológico)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Instalación y ejecución](#instalación-y-ejecución)
8. [Usuarios del sistema](#usuarios-del-sistema)
9. [Funcionalidades](#funcionalidades)
10. [Criterios del proyecto cubiertos](#criterios-del-proyecto-cubiertos)

---

## Descripción del proyecto

**NovaPOS** es un sistema distribuido de punto de venta que simula la gestión de una cadena de tiendas de conveniencia. El sistema maneja:

- **10 sucursales** distribuidas en 3 nodos primarios + 1 nodo de recuperación global
- **+200 registros por tabla** en cada sucursal (productos, ventas, clientes, usuarios)
- **Ventas en tiempo real** con descuento de inventario y replicación automática
- **Reportes** de ventas, ingresos, productos más vendidos e inventario bajo
- **Control de acceso** por roles: Admin, Supervisor, Gerente, Cajero
- **Alta disponibilidad**: si un nodo cae, el sistema sigue operando desde los respaldos

---

## Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│              React + Vite + TypeScript  :5173                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────────────┐
│                        BACKEND                                  │
│                  FastAPI (Python)  :8000                        │
│   ┌──────────────┬──────────────┬───────────────────────────┐  │
│   │ Auth Routes  │ Sales Routes │ Reports / Products / Sync  │  │
│   └──────┬───────┴──────┬───────┴───────────────────────────┘  │
│          │  Capa de distribución (database.py)                  │
│          │  • get_db_with_fallback()                           │
│          │  • replicate_insert / replicate_update              │
│          │  • sync_all_to_backups / sync_all_to_nodo4          │
└──────────┼──────────────┼──────────────────────────────────────┘
           │              │
    ┌──────▼──────────────▼────────────────────────────────────┐
    │                   CAPA DE DATOS                          │
    │                                                          │
    │  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
    │  │  Nodo 1   │  │  Nodo 2   │  │  Nodo 3   │            │
    │  │ :27017    │  │ :27018    │  │ :27019    │            │
    │  │ MongoDB 7 │  │ MongoDB 7 │  │ MongoDB 7 │            │
    │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘            │
    │        │              │              │                    │
    │        └──────────────┴──────────────┘                   │
    │                    Anillo de respaldo cruzado             │
    │                                                          │
    │  ┌───────────────────────────────────────────────────┐   │
    │  │              Nodo 4  :27020                       │   │
    │  │     Réplica Global (global_tienda_*)              │   │
    │  │     Sincronización automática cada 5 minutos      │   │
    │  └───────────────────────────────────────────────────┘   │
    └──────────────────────────────────────────────────────────┘
```

---

## Distribución de datos (Fragmentación)

Se implementa **fragmentación horizontal** — cada sucursal tiene su propia base de datos en el nodo que le corresponde geográficamente.

### Particionamiento por nodo

| Nodo | Puerto | Sucursales (bases primarias) |
|------|--------|------------------------------|
| **Nodo 1** | 27017 | `tienda_centro`, `tienda_norte` + `oxxo_central` |
| **Nodo 2** | 27018 | `tienda_sur`, `tienda_este`, `tienda_oeste` |
| **Nodo 3** | 27019 | `tienda_universidad`, `tienda_insurgentes`, `tienda_tecnologico`, `tienda_alameda`, `tienda_jardines` |
| **Nodo 4** | 27020 | `global_tienda_*` (réplica de todas) |

### Colecciones por base de datos

Cada base de datos de tienda contiene:

| Colección | Registros | Descripción |
|-----------|-----------|-------------|
| `productos` | 220+ | Catálogo de mercancías con stock |
| `ventas` | 300+ | Historial de transacciones |
| `clientes` | 250+ | Perfiles de clientes |
| `usuarios` | 3+ | Cuentas del sistema por sucursal |

**Total del sistema: ~7,700+ documentos distribuidos entre los 4 nodos.**

---

## Replicación y alta disponibilidad

### Anillo de respaldo cruzado (Nodos 1–3)

Cada nodo almacena una copia (`bkp_*`) de las tiendas del nodo anterior:

```
Nodo 1 ──respaldo──▶ Nodo 2 ──respaldo──▶ Nodo 3 ──respaldo──▶ Nodo 1
(bkp_sur, bkp_este,    (bkp_centro,          (bkp_universidad,
 bkp_oeste en N2)       bkp_norte en N3)       bkp_jardines... en N1)
```

### Cadena de fallback

Cuando se hace una consulta, el sistema intenta en orden:

```
1. Nodo primario de la tienda   → respuesta en <5ms
2. Nodo de respaldo cruzado     → respuesta en <50ms (si primario cayó)
3. Nodo 4 (réplica global)      → último recurso si caen 2 nodos
4. Error 503                    → solo si los 3 nodos están caídos
```

### Replicación en escrituras

Cada venta o modificación se escribe simultáneamente en:
- Base de datos primaria de la tienda
- `bkp_tienda_*` en el nodo de respaldo cruzado
- `global_tienda_*` en el Nodo 4

### Sincronización automática

- **Cada 5 minutos**: el backend sincroniza todos los datos primarios → `bkp_*` → Nodo 4
- **Recovery automático**: cuando un nodo caído vuelve a subir, se detecta automáticamente y se propagan los datos escritos en el respaldo de vuelta al nodo primario

### Caché de salud de nodos

Para evitar esperas largas cuando un nodo cae:
- `serverSelectionTimeoutMS = 400ms` (falla rápido)
- Caché de estado con TTL de 5s para nodos caídos
- Re-probe en background sin bloquear la petición actual
- El endpoint `/health` consulta los 4 nodos en paralelo

---

## Stack tecnológico

### Backend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Python | 3.11+ | Lenguaje principal |
| FastAPI | 0.111+ | Framework REST API |
| PyMongo | 4.x | Driver MongoDB |
| bcrypt | 4.x | Hash de contraseñas |
| PyJWT | 2.x | Autenticación JWT |
| uvicorn | 0.29+ | Servidor ASGI |

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18 | UI |
| TypeScript | 5 | Tipado estático |
| Vite | 8 | Build tool |
| Recharts | 2.x | Gráficas |
| Lucide React | latest | Íconos |
| Axios | 1.x | Cliente HTTP |

### Base de datos e infraestructura
| Tecnología | Versión | Uso |
|------------|---------|-----|
| MongoDB | 7 | Base de datos NoSQL |
| Docker | 24+ | Contenedores de nodos |
| Docker Compose | 2.x | Orquestación de nodos |

---

## Estructura del proyecto

```
proyecto-bd/
├── docker-compose.yml          # Definición de los 4 nodos MongoDB
├── backend/
│   ├── main.py                 # Entrada FastAPI + /health endpoint
│   ├── database.py             # Capa de distribución: fallback, replicación, sync
│   ├── auth.py                 # JWT, hash, validación de tokens
│   └── routers/
│       ├── auth_routes.py      # Login con fallback a respaldo
│       ├── sales_routes.py     # Ventas con replicación en escritura
│       ├── products_routes.py  # Inventario con fallback
│       ├── reports_routes.py   # Reportes multi-nodo con fallback
│       ├── clients_routes.py   # Gestión de clientes
│       ├── users_routes.py     # Usuarios con replicación
│       ├── stores_routes.py    # Tiendas y sucursales
│       ├── explorer_routes.py  # Explorador de BD (admin)
│       └── sync_routes.py      # Sincronización y estado de réplicas
└── src/
    ├── pages/
    │   ├── Login.tsx           # Login con estado de nodos en tiempo real
    │   ├── Dashboard.tsx       # Panel principal con métricas
    │   ├── NuevaVenta.tsx      # POS: productos, cliente, ticket
    │   ├── Historial.tsx       # Historial de ventas
    │   ├── Productos.tsx       # Inventario por sucursal
    │   ├── Reportes.tsx        # Gráficas y estadísticas
    │   ├── Explorer.tsx        # Explorador de bases de datos
    │   └── Nodo4.tsx           # Estado de replicación
    └── components/
        ├── Sidebar.tsx         # Navegación con estado de nodos
        └── StatCard.tsx        # Tarjeta de métrica con color
```

---

## Instalación y ejecución

### Requisitos previos

- Docker Desktop instalado y corriendo
- Node.js 18+
- Python 3.11+

### 1. Levantar los nodos MongoDB

```bash
docker-compose up -d
```

Esto levanta 4 contenedores:
- `oxxo_nodo1` → puerto 27017
- `oxxo_nodo2` → puerto 27018
- `oxxo_nodo3` → puerto 27019
- `oxxo_nodo4` → puerto 27020

Verificar que estén corriendo:
```bash
docker ps
```

### 2. Instalar dependencias del backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install fastapi uvicorn pymongo bcrypt pyjwt python-multipart
```

### 3. Iniciar el backend

```bash
cd backend
uvicorn main:app --reload
```

El API estará disponible en: `http://localhost:8000`  
Documentación interactiva: `http://localhost:8000/docs`

### 4. Instalar dependencias del frontend

```bash
# En la raíz del proyecto
npm install
```

### 5. Iniciar el frontend

```bash
npm run dev
```

La aplicación estará en: `http://localhost:5173`

---

## Usuarios del sistema

Los usuarios se crean al inicializar la base de datos (seed). Credenciales de ejemplo:

| Usuario | Contraseña | Rol | Acceso |
|---------|-----------|-----|--------|
| `admin` | `admin123` | Administrador | Todo el sistema |
| `supervisor1` | `sup123` | Supervisor | Múltiples sucursales |
| `gerente_centro` | `ger123` | Gerente | Su sucursal |
| `cajero_centro` | `caj123` | Cajero | Ventas de su sucursal |

> Los roles controlan qué módulos y sucursales puede ver cada usuario.

---

## Funcionalidades

### Para todos los roles
- Login seguro con JWT y bcrypt
- Nueva venta con selección de productos, cliente y método de pago
- Historial de ventas de la sucursal
- Inventario en tiempo real con alertas de stock bajo

### Para Gerentes y superiores
- Reportes de ventas: ingresos diarios, top productos, métodos de pago
- Agregar mercancía (ajuste de inventario)
- Gestión de usuarios de la sucursal

### Para Supervisores y Admin
- Dashboard global con métricas de todas las sucursales
- Reportes comparativos multi-sucursal
- Vista de estado de los 4 nodos en tiempo real

### Solo Admin
- Explorador de bases de datos con edición de documentos
- Página de Estado de Replicación:
  - Estado del Nodo 4 (réplica global)
  - Mapa visual del anillo de respaldo cruzado
  - Datos replicados por colección y base de datos
  - Sincronización manual y automática

### Alta disponibilidad (transparente al usuario)
- Si cae un nodo, la información se sirve desde el respaldo sin intervención
- El login funciona aunque el nodo del usuario esté caído
- Las ventas se registran en el nodo disponible más cercano
- Recovery automático cuando el nodo vuelve a subir

---

## Criterios del proyecto cubiertos

| Criterio | Implementación |
|----------|---------------|
| Sistema de ventas tipo OXXO | NovaPOS con POS completo, ticket, cliente |
| 10 tiendas distribuidas | 10 sucursales en 3 nodos particionados |
| +200 registros por tabla | ~220 productos, ~300 ventas, ~250 clientes por tienda |
| Altas (ventas) | Módulo de Nueva Venta con replicación en escritura |
| Reportes de ventas | Ingresos diarios, top productos, comparativo, inventario |
| Particionamiento de datos | Fragmentación horizontal por nodo geográfico |
| Restricción de acceso | Roles JWT: admin/supervisor/gerente/cajero |
| BD distribuida en nodos | 4 contenedores Docker MongoDB independientes |
| Replicación | Anillo cruzado N1↔N2↔N3 + réplica global N4 |
| Alta disponibilidad | Cadena de fallback primario→respaldo→nodo4 |

---

## Integrantes del equipo


- Abraham Robledo
- Alejandro Cedeño
- Saul Alvarez 
- Laura Jaretzi Domínguez

---

## Materia y profesor

- **Materia**: Bases de Datos Distribuidas
- **Grupo**: 8°B
- **Profesor**: Gabriel Zaragoza — gabriel.zaragoza@edu.uaa.mx
- **Universidad**: Universidad Autónoma de Aguascalientes
- **Fecha de entrega**: 19 de Junio 2026
