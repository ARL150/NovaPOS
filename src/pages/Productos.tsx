import { useEffect, useState, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import {
  Search, Package, ChevronLeft, ChevronRight,
  AlertTriangle, XCircle, CheckCircle, Plus, Minus,
  MapPin, RefreshCw, X, Tag, Save,
  Coffee, GlassWater, Milk, Wheat, Sparkles, Cookie,
  Beef, Leaf, Pill, ShoppingBag, Cigarette, Sandwich,
} from 'lucide-react'

const CAT_ICON: Record<string, LucideIcon> = {
  bebidas:            GlassWater,
  'bebidas calientes': Coffee,
  café:               Coffee,
  lácteos:            Milk,
  lacteos:            Milk,
  panadería:          Wheat,
  panaderia:          Wheat,
  snacks:             Cookie,
  botanas:            Cookie,
  carnes:             Beef,
  frutas:             Leaf,
  verduras:           Leaf,
  limpieza:           Sparkles,
  aseo:               Sparkles,
  farmacia:           Pill,
  salud:              Pill,
  tabaco:             Cigarette,
  cigarros:           Cigarette,
  alimentos:          Sandwich,
  comida:             Sandwich,
  otros:              ShoppingBag,
  general:            ShoppingBag,
}

const getCatIcon = (cat: string): LucideIcon => {
  const key = cat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [k, v] of Object.entries(CAT_ICON)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (key.includes(kn) || kn.includes(key)) return v
  }
  return Tag
}

const TIENDAS = [
  'tienda_centro','tienda_norte','tienda_sur','tienda_este','tienda_oeste',
  'tienda_universidad','tienda_insurgentes','tienda_tecnologico','tienda_alameda','tienda_jardines',
]
const TIENDA_NOMBRES: Record<string,string> = {
  tienda_centro:'NovaPOS Centro', tienda_norte:'NovaPOS Norte', tienda_sur:'NovaPOS Sur',
  tienda_este:'NovaPOS Este', tienda_oeste:'NovaPOS Oeste', tienda_universidad:'NovaPOS Universidad',
  tienda_insurgentes:'NovaPOS Insurgentes', tienda_tecnologico:'NovaPOS Tecnológico',
  tienda_alameda:'NovaPOS Alameda', tienda_jardines:'NovaPOS Jardines',
}
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

type StockFilter = 'todos' | 'critico' | 'sin_stock' | 'ok'

export default function Productos() {
  const { user, isAdmin } = useAuth()
  const isCajero = user?.role === 'cajero'
  const canRestock = !isCajero
  const canAddProduct = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'gerente'

  const [tiendaKey, setTiendaKey] = useState(user?.tienda || TIENDAS[0])
  const [productos, setProductos] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [buscar, setBuscar] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [stockFilter, setStockFilter] = useState<StockFilter>('todos')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [nodeError, setNodeError] = useState<string | null>(null)
  const [desdeRespaldo, setDesdeRespaldo] = useState(false)

  // Agregar producto
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTienda, setAddTienda] = useState(user?.tienda || TIENDAS[0])
  const [addForm, setAddForm] = useState({ nombre: '', categoria: '', categoriaCustom: '', precio: '', stock: '', proveedor: '', codigo_barras: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [addCatCats, setAddCatCats] = useState<string[]>([])

  // Reabastecimiento
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockCantidad, setRestockCantidad] = useState(0)
  const [restockLoading, setRestockLoading] = useState(false)
  const [restockMsg, setRestockMsg] = useState<{ok: boolean; text: string} | null>(null)

  // Disponibilidad cross-store (cajero)
  const [dispQuery, setDispQuery] = useState('')
  const [dispResults, setDispResults] = useState<any[]>([])
  const [dispNodosCaidos, setDispNodosCaidos] = useState<number[]>([])
  const [dispLoading, setDispLoading] = useState(false)
  const [showDisp, setShowDisp] = useState(false)
  const dispRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const limit = 20

  const loadStats = () => {
    api.get(`/productos/${tiendaKey}/stats/resumen`).then(r => setStats(r.data)).catch(() => {})
  }

  useEffect(() => {
    setPage(1)
    setNodeError(null)
    loadStats()
    api.get(`/productos/${tiendaKey}/categorias/lista`).then(r => setCategorias(r.data)).catch(() => {})
  }, [tiendaKey])

  useEffect(() => {
    setLoading(true)
    setNodeError(null)
    const p = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (buscar) p.set('buscar', buscar)
    if (categoria) p.set('categoria', categoria)
    if (stockFilter === 'sin_stock') p.set('stock_max', '0')
    else if (stockFilter === 'critico') { p.set('stock_min', '1'); p.set('stock_max', '10') }
    else if (stockFilter === 'ok') p.set('stock_min', '11')
    api.get(`/productos/${tiendaKey}?${p}`)
      .then(r => {
        setProductos(r.data.productos); setTotal(r.data.total)
        setDesdeRespaldo(r.data.desde_respaldo ?? false)
      })
      .catch((e: any) => {
        if (e.response?.status === 503) setNodeError(e.response.data.detail)
        setProductos([]); setTotal(0); setDesdeRespaldo(false)
      })
      .finally(() => setLoading(false))
  }, [tiendaKey, page, buscar, categoria, stockFilter])

  const totalPages = Math.ceil(total / limit)

  // Reabastecer
  const doRestock = async (productoId: string, delta: number) => {
    setRestockLoading(true)
    setRestockMsg(null)
    try {
      const { data } = await api.patch(`/productos/${tiendaKey}/${productoId}/stock`, { cantidad: delta })
      setRestockMsg({ ok: true, text: `Stock: ${data.stock_anterior} → ${data.stock_nuevo} uds` })
      setProductos(ps => ps.map(p => p._id === productoId ? { ...p, stock: data.stock_nuevo } : p))
      loadStats()
      setTimeout(() => { setRestockId(null); setRestockMsg(null); setRestockCantidad(0) }, 2000)
    } catch (e: any) {
      setRestockMsg({ ok: false, text: e.response?.data?.detail || 'Error al actualizar' })
    }
    setRestockLoading(false)
  }

  // Cargar categorías para el form de agregar
  useEffect(() => {
    if (!showAddForm) return
    api.get(`/productos/${addTienda}/categorias/lista`).then(r => setAddCatCats(r.data)).catch(() => {})
  }, [showAddForm, addTienda])

  const doAddProduct = async () => {
    const catFinal = addForm.categoria === '__nueva__' ? addForm.categoriaCustom.trim() : addForm.categoria
    if (!addForm.nombre.trim() || !catFinal || !addForm.precio || !addForm.stock) {
      setAddMsg({ ok: false, text: 'Completa los campos obligatorios: nombre, categoría, precio y stock.' })
      return
    }
    setAddSaving(true); setAddMsg(null)
    try {
      await api.post(`/productos/${addTienda}`, {
        nombre: addForm.nombre.trim(),
        categoria: catFinal,
        precio: parseFloat(addForm.precio),
        stock: parseInt(addForm.stock),
        proveedor: addForm.proveedor.trim() || null,
        codigo_barras: addForm.codigo_barras.trim() || null,
      })
      setAddMsg({ ok: true, text: `"${addForm.nombre.trim()}" agregado a ${TIENDA_NOMBRES[addTienda]}.` })
      setAddForm({ nombre: '', categoria: '', categoriaCustom: '', precio: '', stock: '', proveedor: '', codigo_barras: '' })
      // Recargar tabla y stats
      loadStats()
      api.get(`/productos/${tiendaKey}/categorias/lista`).then(r => setCategorias(r.data)).catch(() => {})
      if (addTienda === tiendaKey) {
        const p = new URLSearchParams({ page: String(page), limit: '20' })
        api.get(`/productos/${tiendaKey}?${p}`).then(r => { setProductos(r.data.productos); setTotal(r.data.total) })
      }
    } catch (e: any) {
      setAddMsg({ ok: false, text: e.response?.data?.detail || 'Error al guardar el producto.' })
    }
    setAddSaving(false)
  }

  // Búsqueda cross-store
  const buscarDisponibilidad = (q: string) => {
    clearTimeout(dispRef.current)
    setDispQuery(q)
    if (q.length < 2) { setDispResults([]); return }
    dispRef.current = setTimeout(async () => {
      setDispLoading(true)
      try {
        const { data } = await api.get(`/productos/disponibilidad/buscar?nombre=${encodeURIComponent(q)}`)
        setDispResults(data.resultados ?? data)
        setDispNodosCaidos(data.nodos_caidos ?? [])
      } catch { setDispResults([]); setDispNodosCaidos([]) }
      setDispLoading(false)
    }, 400)
  }

  const STOCK_FILTERS: { id: StockFilter; label: string; color: string }[] = [
    { id: 'todos',    label: 'Todos',       color: 'badge-muted' },
    { id: 'ok',       label: 'En stock',    color: 'badge-success' },
    { id: 'critico',  label: 'Stock bajo',  color: 'badge-warning' },
    { id: 'sin_stock',label: 'Sin stock',   color: 'badge-danger' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Inventario</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: 2 }}>
            {TIENDA_NOMBRES[tiendaKey]}
            {canRestock && <span style={{ color: 'var(--text-muted)' }}> · Puedes reabastecer productos</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isCajero && (
            <button
              className={`btn ${showDisp ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowDisp(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <MapPin size={14} />
              {showDisp ? 'Cerrar búsqueda' : 'Buscar en otras tiendas'}
            </button>
          )}
          {isAdmin && (
            <select value={tiendaKey} onChange={e => { setTiendaKey(e.target.value); setPage(1) }} style={{ width: 'auto' }}>
              {TIENDAS.map(k => <option key={k} value={k}>{TIENDA_NOMBRES[k]}</option>)}
            </select>
          )}
          {canAddProduct && (
            <button
              className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => { setShowAddForm(s => !s); setAddMsg(null); setAddTienda(isAdmin ? tiendaKey : (user?.tienda || TIENDAS[0])) }}
              style={{ gap: 6 }}
            >
              {showAddForm ? <X size={14} /> : <Plus size={14} />}
              {showAddForm ? 'Cancelar' : 'Agregar producto'}
            </button>
          )}
        </div>
      </div>

      {/* ── Stats cards ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { icon: Package,       label: 'Total productos', val: stats.total,     color: 'var(--accent)',   bg: 'var(--accent-bg)' },
            { icon: CheckCircle,   label: 'En stock',        val: stats.ok,        color: 'var(--success)',  bg: 'var(--success-bg)' },
            { icon: AlertTriangle, label: 'Stock bajo',      val: stats.critico,   color: 'var(--warning)',  bg: 'rgba(210,153,34,.1)' },
            { icon: XCircle,       label: 'Sin stock',       val: stats.sin_stock, color: 'var(--danger)',   bg: 'var(--danger-bg)' },
          ].map(({ icon: Icon, label, val, color, bg }) => (
            <div key={label} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '.7rem', fontWeight: 600 }}>{label}</p>
                <p style={{ color: 'var(--text-h)', fontSize: '1.2rem', fontWeight: 800 }}>{val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Banner error de nodo ── */}
      {nodeError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger)',
        }}>
          <XCircle size={15} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '.85rem' }}>Nodo MongoDB fuera de línea</p>
            <p style={{ color: 'var(--danger)', fontSize: '.78rem', opacity: .8 }}>{nodeError}</p>
          </div>
        </div>
      )}

      {/* ── Banner de respaldo activo ── */}
      {desdeRespaldo && !nodeError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderRadius: 8, background: 'rgba(210,153,34,.1)', border: '1px solid var(--warning)',
        }}>
          <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '.82rem' }}>
              ⚡ Mostrando datos desde nodo de respaldo
            </p>
            <p style={{ color: 'var(--warning)', fontSize: '.73rem', opacity: .85 }}>
              El nodo primario de esta sucursal no está disponible. Los datos se sirven desde la réplica de respaldo y pueden tener un pequeño desfase.
            </p>
          </div>
        </div>
      )}

      {/* ── Panel: Agregar producto ── */}
      {showAddForm && canAddProduct && (
        <div className="card" style={{ padding: '20px 24px', borderColor: 'var(--accent-border)', background: 'var(--accent-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Package size={15} color="var(--accent)" />
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.95rem' }}>Agregar nuevo producto</p>
            {isAdmin && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>Sucursal destino:</span>
                <select value={addTienda} onChange={e => setAddTienda(e.target.value)} style={{ width: 'auto', fontSize: '.82rem' }}>
                  {TIENDAS.map(k => <option key={k} value={k}>{TIENDA_NOMBRES[k]}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Nombre */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Nombre del producto <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                value={addForm.nombre}
                onChange={e => setAddForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Coca-Cola 600ml"
                autoComplete="off"
              />
            </div>

            {/* Categoría */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Categoría <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select value={addForm.categoria} onChange={e => setAddForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {addCatCats.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__nueva__">+ Nueva categoría...</option>
              </select>
            </div>

            {/* Nueva categoría custom */}
            {addForm.categoria === '__nueva__' && (
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                  Nombre de la nueva categoría <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  value={addForm.categoriaCustom}
                  onChange={e => setAddForm(f => ({ ...f, categoriaCustom: e.target.value }))}
                  placeholder="Ej. Electrónica"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Precio */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Precio (MXN) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={addForm.precio}
                onChange={e => setAddForm(f => ({ ...f, precio: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            {/* Stock inicial */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Stock inicial <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="number" min="0"
                value={addForm.stock}
                onChange={e => setAddForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="0"
              />
            </div>

            {/* Proveedor */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Proveedor <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                value={addForm.proveedor}
                onChange={e => setAddForm(f => ({ ...f, proveedor: e.target.value }))}
                placeholder="Ej. Coca-Cola FEMSA"
                autoComplete="off"
              />
            </div>

            {/* Código de barras */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Código de barras <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input
                value={addForm.codigo_barras}
                onChange={e => setAddForm(f => ({ ...f, codigo_barras: e.target.value }))}
                placeholder="Ej. 7501055300008"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Mensaje de resultado */}
          {addMsg && (
            <div style={{
              marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 6,
              background: addMsg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${addMsg.ok ? 'var(--success)' : 'var(--danger)'}`,
            }}>
              {addMsg.ok ? <CheckCircle size={13} color="var(--success)" /> : <XCircle size={13} color="var(--danger)" />}
              <p style={{ color: addMsg.ok ? 'var(--success)' : 'var(--danger)', fontSize: '.82rem', fontWeight: 500 }}>
                {addMsg.text}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setAddMsg(null) }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={doAddProduct}
              disabled={addSaving}
              style={{ gap: 6 }}
            >
              {addSaving
                ? <><RefreshCw size={13} className="spin" /> Guardando...</>
                : <><Save size={13} /> Guardar producto</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Panel: Buscar disponibilidad (cajero) ── */}
      {showDisp && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <MapPin size={15} color="var(--accent)" />
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem' }}>Disponibilidad en todas las sucursales</p>
            <button onClick={() => { setShowDisp(false); setDispResults([]); setDispQuery('') }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={dispQuery}
              onChange={e => buscarDisponibilidad(e.target.value)}
              placeholder="Buscar producto en todas las tiendas..."
              style={{ paddingLeft: 32 }}
            />
          </div>

          {dispLoading && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '.82rem' }}>
              <RefreshCw size={14} className="spin" style={{ display: 'block', margin: '0 auto 6px' }} />
              Consultando 3 nodos MongoDB...
            </div>
          )}

          {!dispLoading && dispResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dispResults.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: r.tienda_key === tiendaKey ? 'var(--accent-bg)' : 'var(--surface2)',
                  borderColor: r.tienda_key === tiendaKey ? 'var(--accent-border)' : 'var(--border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.83rem' }}>{r.nombre}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <MapPin size={10} color="var(--text-muted)" />
                      <span style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{r.tienda_nombre}</span>
                      <span className="badge badge-muted" style={{ fontSize: '.6rem' }}>Nodo {r.nodo}</span>
                      {r.tienda_key === tiendaKey && <span className="badge badge-accent" style={{ fontSize: '.6rem' }}>Tu tienda</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`badge ${r.stock === 0 ? 'badge-danger' : r.stock <= 10 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '.78rem', fontWeight: 800 }}>
                      {r.stock} uds
                    </span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.7rem', marginTop: 3 }}>{fmt(r.precio)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!dispLoading && dispQuery.length >= 2 && dispResults.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem', padding: '12px 0' }}>
              No se encontró el producto en ninguna sucursal
            </p>
          )}
          {!dispLoading && dispQuery.length < 2 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
              Escribe al menos 2 caracteres para buscar en las {TIENDAS.length} sucursales distribuidas.
            </p>
          )}

          {dispNodosCaidos.length > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 7,
              background: 'var(--warning-bg)', border: '1px solid var(--warning)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={13} color="var(--warning)" style={{ flexShrink: 0 }} />
              <p style={{ color: 'var(--warning)', fontSize: '.75rem', fontWeight: 600 }}>
                Nodo{dispNodosCaidos.length > 1 ? 's' : ''} {dispNodosCaidos.join(', ')} fuera de línea — resultados pueden estar incompletos
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Fila 1: búsqueda + stock */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={buscar} onChange={e => { setBuscar(e.target.value); setPage(1) }}
              placeholder="Buscar producto..." style={{ paddingLeft: 32 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {STOCK_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => { setStockFilter(f.id); setPage(1) }}
                className={`badge ${stockFilter === f.id ? f.color : 'badge-muted'}`}
                style={{ cursor: 'pointer', padding: '6px 10px', border: 'none', fontSize: '.75rem', fontWeight: 600 }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 2: categorías con íconos */}
        {categorias.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => { setCategoria(''); setPage(1) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: '.75rem', fontWeight: 600,
                transition: 'all .15s',
                background: categoria === '' ? 'var(--accent-bg)' : 'var(--surface2)',
                borderColor: categoria === '' ? 'var(--accent-border)' : 'var(--border)',
                color: categoria === '' ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <Tag size={11} />
              Todas
            </button>
            {categorias.map(c => {
              const CatIcon = getCatIcon(c)
              const active = categoria === c
              return (
                <button
                  key={c}
                  onClick={() => { setCategoria(active ? '' : c); setPage(1) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                    borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: '.75rem', fontWeight: 600,
                    transition: 'all .15s',
                    background: active ? 'var(--accent-bg)' : 'var(--surface2)',
                    borderColor: active ? 'var(--accent-border)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <CatIcon size={11} />
                  {c}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              {!isCajero && <th>Proveedor</th>}
              <th style={{ textAlign: 'right' }}>Precio</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              {canRestock && <th style={{ textAlign: 'center' }}>Reabastecer</th>}
              {isCajero && <th style={{ textAlign: 'center' }}>Disponibilidad</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '.82rem' }}>
                <RefreshCw size={14} className="spin" style={{ display: 'inline', marginRight: 8 }} />
                Consultando nodo MongoDB...
              </td></tr>
            ) : productos.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '.82rem' }}>
                <Package size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                Sin productos que coincidan
              </td></tr>
            ) : productos.map(p => (
              <>
                <tr key={p._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        background: p.stock === 0 ? 'var(--danger-bg)' : p.stock <= 10 ? 'rgba(210,153,34,.1)' : 'var(--accent-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Package size={12} color={p.stock === 0 ? 'var(--danger)' : p.stock <= 10 ? 'var(--warning)' : 'var(--accent)'} />
                      </div>
                      <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{p.nombre}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-muted">{p.categoria}</span></td>
                  {!isCajero && <td style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>{p.proveedor || '—'}</td>}
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-h)' }}>{fmt(p.precio)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`badge ${p.stock===0?'badge-danger':p.stock<=10?'badge-warning':'badge-success'}`}
                      style={{ fontWeight: 800, fontSize: '.8rem' }}>
                      {p.stock}
                    </span>
                  </td>

                  {/* Botón reabastecer (admin/gerente) */}
                  {canRestock && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '.75rem', gap: 5, color: restockId === p._id ? 'var(--accent)' : 'var(--text-muted)' }}
                        onClick={() => {
                          setRestockId(restockId === p._id ? null : p._id)
                          setRestockCantidad(0)
                          setRestockMsg(null)
                        }}
                      >
                        <Plus size={12} />
                        Reabastecer
                      </button>
                    </td>
                  )}

                  {/* Botón disponibilidad (cajero) */}
                  {isCajero && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: '.75rem', gap: 5 }}
                        onClick={() => {
                          setShowDisp(true)
                          buscarDisponibilidad(p.nombre)
                          setDispQuery(p.nombre)
                          setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
                        }}
                      >
                        <MapPin size={12} />
                        Ver tiendas
                      </button>
                    </td>
                  )}
                </tr>

                {/* Panel inline de reabastecimiento */}
                {canRestock && restockId === p._id && (
                  <tr key={p._id + '_restock'} style={{ background: 'var(--accent-bg)' }}>
                    <td colSpan={7} style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.85rem' }}>
                          {p.nombre} — Stock actual: <strong>{p.stock}</strong>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>Agregar:</span>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px' }}
                            onClick={() => setRestockCantidad(c => Math.max(1, c - 1))}>
                            <Minus size={12} />
                          </button>
                          <input
                            type="number" value={restockCantidad}
                            onChange={e => setRestockCantidad(Math.max(1, parseInt(e.target.value)||1))}
                            style={{ width: 70, textAlign: 'center', padding: '5px 8px' }}
                            min={1}
                          />
                          <button className="btn btn-secondary" style={{ padding: '4px 8px' }}
                            onClick={() => setRestockCantidad(c => c + 1)}>
                            <Plus size={12} />
                          </button>
                          <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>unidades</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[10, 25, 50, 100].map(n => (
                            <button key={n} className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '.73rem',
                                background: restockCantidad === n ? 'var(--accent-bg)' : undefined,
                                color: restockCantidad === n ? 'var(--accent)' : undefined }}
                              onClick={() => setRestockCantidad(n)}>
                              +{n}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <button className="btn btn-secondary" onClick={() => { setRestockId(null); setRestockMsg(null) }}>
                            Cancelar
                          </button>
                          <button
                            className="btn btn-primary" disabled={restockLoading || restockCantidad < 1}
                            onClick={() => doRestock(p._id, restockCantidad)}
                            style={{ gap: 6 }}
                          >
                            {restockLoading ? <RefreshCw size={13} className="spin" /> : <Plus size={13} />}
                            Confirmar +{restockCantidad} uds → {p.stock + restockCantidad} total
                          </button>
                        </div>
                        {restockMsg && (
                          <span style={{ fontSize: '.8rem', fontWeight: 600, color: restockMsg.ok ? 'var(--success)' : 'var(--danger)' }}>
                            {restockMsg.ok ? '✓' : '✗'} {restockMsg.text}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
            Página {page} de {totalPages} · {total.toLocaleString()} productos
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ padding: '6px 10px' }}
              onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>
              <ChevronLeft size={14} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 10px' }}
              onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
