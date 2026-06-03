import { useEffect, useState, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import {
  Plus, Trash2, ShoppingCart, Check, Search, AlertCircle, Minus,
  Banknote, CreditCard, ArrowLeftRight, Ticket, Printer, RotateCcw, Tag,
  Coffee, GlassWater, Milk, Wheat, Sparkles, Cookie,
  Beef, Leaf, Pill, ShoppingBag, Cigarette, Sandwich, Store,
  ChevronDown, Receipt, UserCircle, UserPlus, UserX, X, Mail, Phone,
  BadgeCheck,
} from 'lucide-react'

const CAT_ICON: Record<string, LucideIcon> = {
  bebidas: GlassWater, 'bebidas calientes': Coffee, café: Coffee,
  lácteos: Milk, lacteos: Milk, panadería: Wheat, panaderia: Wheat,
  snacks: Cookie, botanas: Cookie, carnes: Beef,
  frutas: Leaf, verduras: Leaf, limpieza: Sparkles, aseo: Sparkles,
  farmacia: Pill, salud: Pill, tabaco: Cigarette, cigarros: Cigarette,
  alimentos: Sandwich, comida: Sandwich, otros: ShoppingBag, general: ShoppingBag,
}
const getCatIcon = (cat: string): LucideIcon => {
  const key = cat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [k, v] of Object.entries(CAT_ICON)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (key.includes(kn) || kn.includes(key)) return v
  }
  return Tag
}

interface Producto { _id: string; nombre: string; categoria: string; precio: number; stock: number }
interface Item { producto: Producto; cantidad: number }
interface Cliente { _id: string; nombre: string; email: string; telefono: string; rfc?: string; ciudad?: string }

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

export default function NuevaVenta() {
  const { user, isAdmin } = useAuth()
  const [tiendaKey, setTiendaKey] = useState(user?.tienda || TIENDAS[0])
  const [productos, setProductos] = useState<Producto[]>([])
  const [buscar, setBuscar] = useState('')
  const [categoria, setCategoria] = useState('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [carrito, setCarrito] = useState<Item[]>([])
  const [metodo, setMetodo] = useState('efectivo')
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState<any>(null)
  const [exitoItems, setExitoItems] = useState<Item[]>([])
  const [exitoMetodo, setExitoMetodo] = useState('')
  const [exitoCliente, setExitoCliente] = useState<Cliente | null | 'anonimo'>(null)
  const [pagoCon, setPagoCon] = useState('')
  const [error, setError] = useState('')

  // ── Cliente ──
  type ModoCliente = 'anonimo' | 'buscar' | 'nuevo'
  const [modoCliente, setModoCliente] = useState<ModoCliente>('anonimo')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [buscarCliente, setBuscarCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', email: '', telefono: '', rfc: '' })
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const buscarClienteRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setCarrito([]); setExito(null); setCategoria('')
    setClienteSeleccionado(null); setBuscarCliente(''); setResultadosCliente([])
    api.get(`/productos/${tiendaKey}/categorias/lista`)
      .then(r => setCategorias(r.data)).catch(() => setCategorias([]))
  }, [tiendaKey])

  const onBuscarCliente = (q: string) => {
    setBuscarCliente(q)
    setClienteSeleccionado(null)
    clearTimeout(buscarClienteRef.current)
    if (!q.trim()) { setResultadosCliente([]); return }
    buscarClienteRef.current = setTimeout(async () => {
      setBuscandoCliente(true)
      try {
        const r = await api.get(`/clientes/${tiendaKey}?q=${encodeURIComponent(q)}&limit=6`)
        setResultadosCliente(r.data)
      } catch { setResultadosCliente([]) }
      finally { setBuscandoCliente(false) }
    }, 280)
  }

  const guardarNuevoCliente = async () => {
    if (!nuevoCliente.nombre.trim()) return
    setGuardandoCliente(true)
    try {
      const r = await api.post(`/clientes/${tiendaKey}`, nuevoCliente)
      setClienteSeleccionado(r.data)
      setModoCliente('buscar')
      setBuscarCliente(r.data.nombre)
      setResultadosCliente([])
      setNuevoCliente({ nombre: '', email: '', telefono: '', rfc: '' })
    } catch { /* ignore */ }
    finally { setGuardandoCliente(false) }
  }

  useEffect(() => {
    const p = new URLSearchParams({ limit: '60' })
    if (buscar) p.set('buscar', buscar)
    if (categoria) p.set('categoria', categoria)
    api.get(`/productos/${tiendaKey}?${p}`)
      .then(r => setProductos(r.data.productos)).catch(() => setProductos([]))
  }, [tiendaKey, buscar, categoria])

  const agregar = (prod: Producto) => {
    if (prod.stock === 0) return
    setCarrito(c => {
      const ex = c.find(i => i.producto._id === prod._id)
      if (ex) return c.map(i => i.producto._id === prod._id
        ? { ...i, cantidad: Math.min(i.cantidad+1, prod.stock) } : i)
      return [...c, { producto: prod, cantidad: 1 }]
    })
  }
  const remover = (id: string) => setCarrito(c => c.filter(i => i.producto._id !== id))
  const cambiar = (id: string, delta: number) => setCarrito(c =>
    c.map(i => i.producto._id === id
      ? { ...i, cantidad: Math.max(1, Math.min(i.cantidad+delta, i.producto.stock)) }
      : i))

  const subtotal = carrito.reduce((a,b) => a + b.producto.precio*b.cantidad, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  const submit = async () => {
    if (!carrito.length) { setError('El carrito está vacío'); return }
    setError(''); setLoading(true)
    const nombreCliente = modoCliente === 'anonimo'
      ? 'Cliente General'
      : clienteSeleccionado?.nombre || 'Cliente General'
    try {
      const { data } = await api.post('/ventas/', {
        tienda_key: tiendaKey, cliente_nombre: nombreCliente, metodo_pago: metodo,
        items: carrito.map(i => ({ producto_id: i.producto._id, cantidad: i.cantidad, precio_unitario: i.producto.precio })),
      })
      setExitoItems([...carrito])
      setExitoMetodo(metodo)
      setExitoCliente(modoCliente === 'anonimo' ? 'anonimo' : clienteSeleccionado)
      setPagoCon('')
      setExito(data.venta)
      setCarrito([])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al registrar venta')
    } finally { setLoading(false) }
  }

  const pagoNum = parseFloat(pagoCon) || 0
  const cambio = pagoNum - (exito?.total || 0)
  const METODO_LABEL: Record<string,string> = {
    efectivo: 'Efectivo', tarjeta_debito: 'Tarjeta débito',
    tarjeta_credito: 'Tarjeta crédito', transferencia: 'Transferencia', vales: 'Vales',
  }

  /* ── Vista de ticket ── */
  if (exito) {
    const now = new Date()
    const fechaStr = now.toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' })
    const horaStr  = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })

    return (
      <div style={{ maxWidth: 500, margin: '24px auto' }} className="fade-up">
        <div id="ticket-print" className="card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* Cabecera verde */}
          <div style={{
            background: 'linear-gradient(135deg, var(--success-bg) 0%, var(--accent-bg) 100%)',
            borderBottom: '1px solid var(--border)', padding: '28px 28px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%', margin: '0 auto 14px',
              background: 'var(--success)', boxShadow: '0 0 0 8px rgba(63,185,80,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={26} color="#fff" strokeWidth={3} />
            </div>
            <h2 style={{ color: 'var(--text-h)', fontSize: '1.1rem', fontWeight: 800, marginBottom: 4 }}>
              ¡Venta registrada!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{fechaStr} · {horaStr}</p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 999, padding: '4px 12px',
            }}>
              <Receipt size={11} color="var(--accent)" />
              <code style={{ color: 'var(--accent)', fontSize: '.72rem', fontWeight: 700 }}>
                #{exito._id?.slice(-8).toUpperCase()}
              </code>
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Info rápida */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {/* Tarjeta de cliente */}
              {exitoCliente && exitoCliente !== 'anonimo' && typeof exitoCliente === 'object' ? (
                <div style={{
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  borderRadius: 10, padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: '.9rem',
                  }}>
                    {(exitoCliente as Cliente).nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.88rem', marginBottom: 3 }}>{(exitoCliente as Cliente).nombre}</p>
                    {(exitoCliente as Cliente).email && <p style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>✉ {(exitoCliente as Cliente).email}</p>}
                    {(exitoCliente as Cliente).telefono && <p style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>📞 {(exitoCliente as Cliente).telefono}</p>}
                    {(exitoCliente as Cliente).rfc && <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', fontFamily: 'monospace' }}>RFC: {(exitoCliente as Cliente).rfc}</p>}
                  </div>
                  <BadgeCheck size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                </div>
              ) : (
                <div style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <UserX size={16} color="var(--text-muted)" />
                  <div>
                    <p style={{ color: 'var(--text-h)', fontSize: '.82rem', fontWeight: 600 }}>Cliente General</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>Venta anónima sin datos registrados</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Método de pago', value: METODO_LABEL[exitoMetodo] || exitoMetodo },
                  { label: 'Atendido por', value: user?.nombre || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{label}</p>
                    <p style={{ color: 'var(--text-h)', fontSize: '.8rem', fontWeight: 700 }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Productos */}
            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 16, marginBottom: 14 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                Productos
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {exitoItems.map(item => (
                  <div key={item.producto._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: 'var(--text-h)', fontSize: '.82rem', fontWeight: 600 }}>{item.producto.nombre}</span>
                      <span style={{
                        display: 'inline-block', marginLeft: 7,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 4, padding: '0px 5px', fontSize: '.65rem', color: 'var(--text-muted)',
                      }}>×{item.cantidad}</span>
                    </div>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '.82rem', flexShrink: 0, marginLeft: 12 }}>
                      {fmt(item.producto.precio * item.cantidad)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {[['Subtotal', exito.subtotal], ['IVA (16%)', exito.iva]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: '.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text)' }}>{fmt(v as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', fontSize: '1.05rem', fontWeight: 800 }}>
                <span style={{ color: 'var(--text-h)' }}>Total</span>
                <span style={{ color: 'var(--accent)' }}>{fmt(exito.total)}</span>
              </div>
            </div>

            {/* Calculadora de cambio */}
            {exitoMetodo === 'efectivo' && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px', marginBottom: 4 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Calculadora de cambio
                </p>
                <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[50, 100, 200, 500, 1000].map(n => (
                    <button key={n} onClick={() => setPagoCon(String(n))} className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '.75rem', fontWeight: 700,
                        background: pagoNum === n ? 'var(--accent-bg)' : undefined,
                        borderColor: pagoNum === n ? 'var(--accent-border)' : undefined,
                        color: pagoNum === n ? 'var(--accent)' : undefined,
                      }}>
                      ${n}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>$</span>
                  <input type="number" value={pagoCon} onChange={e => setPagoCon(e.target.value)}
                    placeholder="Monto recibido" style={{ paddingLeft: 22 }} min={exito.total} />
                </div>
                {pagoNum >= exito.total && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8 }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '.85rem' }}>Cambio</span>
                    <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.15rem' }}>{fmt(cambio)}</span>
                  </div>
                )}
                {pagoNum > 0 && pagoNum < exito.total && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8 }}>
                    <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '.85rem' }}>Falta</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '1.05rem' }}>{fmt(exito.total - pagoNum)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={() => window.print()}
            style={{ flex: 1, gap: 7, justifyContent: 'center', padding: '11px' }}>
            <Printer size={15} /> Imprimir ticket
          </button>
          <button className="btn btn-primary" onClick={() => { setExito(null); setExitoItems([]) }}
            style={{ flex: 1, gap: 7, justifyContent: 'center', padding: '11px' }}>
            <RotateCcw size={15} /> Nueva venta
          </button>
        </div>
      </div>
    )
  }

  /* ── Vista principal de venta ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Header con tienda ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShoppingCart size={18} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-h)', fontSize: '1.2rem', fontWeight: 800, lineHeight: 1.2 }}>
              Nueva venta
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Store size={11} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>
                {TIENDA_NOMBRES[tiendaKey]}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div style={{ position: 'relative' }}>
            <select
              value={tiendaKey}
              onChange={e => setTiendaKey(e.target.value)}
              style={{ width: 'auto', paddingRight: 32, appearance: 'none', cursor: 'pointer' }}
            >
              {TIENDAS.map(k => <option key={k} value={k}>{TIENDA_NOMBRES[k]}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>

      {/* ── Layout principal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 14, alignItems: 'start' }}>

        {/* ══ Catálogo ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Buscador */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar producto por nombre…"
              style={{ paddingLeft: 36, width: '100%', fontSize: '.85rem', padding: '10px 12px 10px 36px' }}
            />
          </div>

          {/* Chips de categoría */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setCategoria('')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: '.73rem', fontWeight: 600,
                background: categoria === '' ? 'var(--accent-bg)' : 'var(--surface2)',
                borderColor: categoria === '' ? 'var(--accent-border)' : 'var(--border)',
                color: categoria === '' ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all .12s',
              }}
            >
              <Tag size={11} /> Todas
            </button>
            {categorias.map(c => {
              const CatIcon = getCatIcon(c)
              const active = categoria === c
              return (
                <button key={c} onClick={() => setCategoria(active ? '' : c)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: '.73rem', fontWeight: 600,
                  background: active ? 'var(--accent-bg)' : 'var(--surface2)',
                  borderColor: active ? 'var(--accent-border)' : 'var(--border)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all .12s',
                }}>
                  <CatIcon size={11} /> {c}
                </button>
              )
            })}
          </div>

          {/* Grid de productos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
            {productos.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>
                <Search size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: .2 }} />
                Sin productos que coincidan
              </div>
            ) : productos.map(p => {
              const enCarrito = carrito.find(i => i.producto._id === p._id)
              const CatIcon = getCatIcon(p.categoria)
              return (
                <button
                  key={p._id}
                  onClick={() => agregar(p)}
                  disabled={p.stock === 0}
                  style={{
                    textAlign: 'left', padding: '12px', borderRadius: 10, cursor: p.stock ? 'pointer' : 'not-allowed',
                    background: enCarrito ? 'var(--accent-bg)' : 'var(--surface)',
                    border: `1px solid ${enCarrito ? 'var(--accent-border)' : 'var(--border)'}`,
                    transition: 'all .15s', opacity: p.stock === 0 ? 0.4 : 1,
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { if (p.stock && !enCarrito) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)' }}
                  onMouseLeave={e => { if (!enCarrito) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  {/* Badge de cantidad en carrito */}
                  {enCarrito && (
                    <div style={{
                      position: 'absolute', top: 7, right: 7,
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: '50%', width: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '.65rem', fontWeight: 800,
                    }}>
                      {enCarrito.cantidad}
                    </div>
                  )}

                  {/* Icono de categoría */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, marginBottom: 8,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CatIcon size={14} color={enCarrito ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>

                  <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.78rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: enCarrito ? 22 : 0 }}>
                    {p.nombre}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.categoria}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: enCarrito ? 'var(--accent)' : 'var(--text-h)', fontWeight: 800, fontSize: '.88rem' }}>
                      {fmt(p.precio)}
                    </span>
                    <span style={{
                      fontSize: '.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: p.stock === 0 ? 'var(--danger-bg)' : p.stock <= 10 ? 'rgba(210,153,34,.15)' : 'var(--surface2)',
                      color: p.stock === 0 ? 'var(--danger)' : p.stock <= 10 ? 'var(--warning)' : 'var(--text-muted)',
                      border: `1px solid ${p.stock === 0 ? 'var(--danger)' : p.stock <= 10 ? 'rgba(210,153,34,.3)' : 'var(--border)'}`,
                    }}>
                      {p.stock === 0 ? 'Agotado' : `${p.stock} uds`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ══ Carrito ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'sticky', top: 0 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Header del carrito */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={16} color="var(--accent)" />
                <span style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.9rem' }}>Carrito</span>
                {carrito.length > 0 && (
                  <span style={{
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 999, padding: '1px 8px', fontSize: '.65rem', fontWeight: 800,
                  }}>{carrito.length}</span>
                )}
              </div>
              {carrito.length > 0 && (
                <button
                  onClick={() => setCarrito([])}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <Trash2 size={11} /> Vaciar
                </button>
              )}
            </div>

            {/* ── Sección de cliente ── */}
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Selector de modo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, borderBottom: '1px solid var(--border)' }}>
                {([
                  { id: 'anonimo', Icon: UserX,      label: 'Sin datos'  },
                  { id: 'buscar',  Icon: Search,     label: 'Buscar'     },
                  { id: 'nuevo',   Icon: UserPlus,   label: 'Nuevo'      },
                ] as { id: ModoCliente; Icon: any; label: string }[]).map(({ id, Icon, label }) => (
                  <button key={id} onClick={() => { setModoCliente(id); if (id !== 'buscar') { setBuscarCliente(''); setResultadosCliente([]) } }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      padding: '9px 4px', border: 'none', cursor: 'pointer',
                      background: modoCliente === id ? 'var(--accent-bg)' : 'var(--surface2)',
                      borderRight: id !== 'nuevo' ? '1px solid var(--border)' : 'none',
                      color: modoCliente === id ? 'var(--accent)' : 'var(--text-muted)',
                      transition: 'all .12s',
                    }}>
                    <Icon size={13} />
                    <span style={{ fontSize: '.62rem', fontWeight: modoCliente === id ? 700 : 500 }}>{label}</span>
                  </button>
                ))}
              </div>

              {/* Modo: sin datos */}
              {modoCliente === 'anonimo' && (
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserX size={14} color="var(--text-muted)" />
                  <p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>Venta sin datos de cliente</p>
                </div>
              )}

              {/* Modo: buscar */}
              {modoCliente === 'buscar' && (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {clienteSeleccionado ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 8,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: '.72rem', flexShrink: 0,
                      }}>
                        {clienteSeleccionado.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-h)', fontSize: '.78rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteSeleccionado.nombre}</p>
                        {clienteSeleccionado.telefono && <p style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>{clienteSeleccionado.telefono}</p>}
                      </div>
                      <button onClick={() => { setClienteSeleccionado(null); setBuscarCliente('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input
                        value={buscarCliente}
                        onChange={e => onBuscarCliente(e.target.value)}
                        placeholder="Nombre, email o teléfono…"
                        style={{ paddingLeft: 28, width: '100%', fontSize: '.78rem' }}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {/* Resultados */}
                  {!clienteSeleccionado && buscarCliente && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {buscandoCliente ? (
                        <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.72rem' }}>Buscando…</div>
                      ) : resultadosCliente.length === 0 ? (
                        <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '.72rem' }}>Sin resultados — ¿quieres crearlo?</div>
                      ) : resultadosCliente.map((c, i) => (
                        <button key={c._id} onClick={() => { setClienteSeleccionado(c); setBuscarCliente(c.nombre); setResultadosCliente([]) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                            borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                            transition: 'background .1s',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UserCircle size={13} color="var(--text-muted)" />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ color: 'var(--text-h)', fontSize: '.76rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || c.telefono || '—'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Modo: nuevo cliente */}
              {modoCliente === 'nuevo' && (
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente(n => ({ ...n, nombre: e.target.value }))}
                    placeholder="Nombre completo *" autoComplete="off"
                    style={{ width: '100%', fontSize: '.78rem' }} />
                  <div style={{ position: 'relative' }}>
                    <Mail size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input value={nuevoCliente.email} onChange={e => setNuevoCliente(n => ({ ...n, email: e.target.value }))}
                      placeholder="Email" autoComplete="off" style={{ paddingLeft: 26, width: '100%', fontSize: '.78rem' }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Phone size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente(n => ({ ...n, telefono: e.target.value }))}
                      placeholder="Teléfono" autoComplete="off" style={{ paddingLeft: 26, width: '100%', fontSize: '.78rem' }} />
                  </div>
                  <input value={nuevoCliente.rfc} onChange={e => setNuevoCliente(n => ({ ...n, rfc: e.target.value.toUpperCase() }))}
                    placeholder="RFC (opcional)" autoComplete="off" maxLength={13}
                    style={{ width: '100%', fontSize: '.78rem', fontFamily: 'monospace' }} />
                  <button className="btn btn-primary" onClick={guardarNuevoCliente}
                    disabled={guardandoCliente || !nuevoCliente.nombre.trim()}
                    style={{ width: '100%', gap: 6, justifyContent: 'center', fontSize: '.78rem' }}>
                    {guardandoCliente ? 'Guardando…' : <><UserPlus size={13} /> Registrar y seleccionar</>}
                  </button>
                </div>
              )}
            </div>

            {/* Método de pago */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Método de pago
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
                {([
                  { id: 'efectivo',        label: 'Efectivo',   Icon: Banknote       },
                  { id: 'tarjeta_debito',  label: 'Débito',     Icon: CreditCard     },
                  { id: 'tarjeta_credito', label: 'Crédito',    Icon: CreditCard     },
                  { id: 'transferencia',   label: 'Transfer.',  Icon: ArrowLeftRight },
                  { id: 'vales',           label: 'Vales',      Icon: Ticket         },
                ] as { id: string; label: string; Icon: any }[]).map(({ id, label, Icon }) => {
                  const active = metodo === id
                  return (
                    <button
                      key={id}
                      onClick={() => setMetodo(id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 4, padding: '9px 4px', borderRadius: 8, cursor: 'pointer',
                        background: active ? 'var(--accent-bg)' : 'var(--surface2)',
                        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                        transition: 'all .15s',
                        gridColumn: id === 'transferencia' ? 'span 2' : undefined,
                      }}
                    >
                      <Icon size={14} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '.65rem', fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ítems del carrito */}
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {!carrito.length ? (
                <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
                  <ShoppingCart size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: .2 }} />
                  <p style={{ fontSize: '.78rem' }}>El carrito está vacío</p>
                  <p style={{ fontSize: '.7rem', marginTop: 4, opacity: .7 }}>Agrega productos del catálogo</p>
                </div>
              ) : carrito.map((item, idx) => (
                <div key={item.producto._id} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px',
                  borderBottom: idx < carrito.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background .1s',
                }}>
                  {/* Nombre + precio unitario */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-h)', fontSize: '.76rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.producto.nombre}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.67rem', marginTop: 1 }}>
                      {fmt(item.producto.precio)} c/u
                    </p>
                  </div>

                  {/* Controles de cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => cambiar(item.producto._id, -1)}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface2)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                      }}
                    >
                      <Minus size={10} />
                    </button>
                    <span style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.8rem', minWidth: 18, textAlign: 'center' }}>
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => cambiar(item.producto._id, 1)}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface2)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                      }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  {/* Total línea */}
                  <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '.82rem', minWidth: 58, textAlign: 'right', flexShrink: 0 }}>
                    {fmt(item.producto.precio * item.cantidad)}
                  </span>

                  {/* Eliminar */}
                  <button
                    onClick={() => remover(item.producto._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', flexShrink: 0, padding: '2px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {[['Subtotal', subtotal], ['IVA 16%', iva]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', fontSize: '.78rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text)' }}>{fmt(v as number)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 14px', borderTop: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.92rem' }}>Total</span>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.15rem' }}>{fmt(total)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', background: 'var(--danger-bg)', borderTop: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '.78rem' }}>
                <AlertCircle size={13} />{error}
              </div>
            )}

            {/* Botón cobrar */}
            <div style={{ padding: '12px 14px' }}>
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={loading || !carrito.length}
                style={{
                  width: '100%', padding: '12px', fontSize: '.9rem', fontWeight: 800, gap: 8,
                  justifyContent: 'center', borderRadius: 10,
                  background: carrito.length ? 'var(--accent)' : undefined,
                  opacity: !carrito.length ? .5 : 1,
                }}
              >
                {loading
                  ? <><RotateCcw size={15} className="spin" /> Procesando…</>
                  : <><Check size={16} /> Cobrar {carrito.length > 0 ? fmt(total) : ''}</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
