import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'
import StatCard from '../components/StatCard'
import {
  TrendingUp, ShoppingCart, Store, DollarSign, RefreshCw,
  BarChart2, Package, AlertTriangle, Wifi, WifiOff, Loader,
  ChevronDown, ShieldCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'

const TIENDAS_ALL = [
  'tienda_centro','tienda_norte','tienda_sur','tienda_este','tienda_oeste',
  'tienda_universidad','tienda_insurgentes','tienda_tecnologico','tienda_alameda','tienda_jardines',
]
const TIENDA_NOMBRES: Record<string,string> = {
  tienda_centro:'NovaPOS Centro', tienda_norte:'NovaPOS Norte', tienda_sur:'NovaPOS Sur',
  tienda_este:'NovaPOS Este', tienda_oeste:'NovaPOS Oeste', tienda_universidad:'NovaPOS Universidad',
  tienda_insurgentes:'NovaPOS Insurgentes', tienda_tecnologico:'NovaPOS Tecnológico',
  tienda_alameda:'NovaPOS Alameda', tienda_jardines:'NovaPOS Jardines',
}
const TIENDA_NODO: Record<string,number> = {
  tienda_centro:1, tienda_norte:1,
  tienda_sur:2, tienda_este:2, tienda_oeste:2,
  tienda_universidad:3, tienda_insurgentes:3, tienda_tecnologico:3, tienda_alameda:3, tienda_jardines:3,
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
const fmtK = (n: number) =>
  n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n.toFixed(0)}`

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

type NodeStatus = 'OK' | 'ERROR' | 'checking'

const NODE_INFO = [
  { n: 1, port: '27017', stores: 'Centro · Norte',      keys: ['tienda_centro','tienda_norte'], recovery: false },
  { n: 2, port: '27018', stores: 'Sur · Este · Oeste',  keys: ['tienda_sur','tienda_este','tienda_oeste'], recovery: false },
  { n: 3, port: '27019', stores: 'Univ. · Insurgentes · Tecno. · Alameda · Jardines', keys: ['tienda_universidad','tienda_insurgentes','tienda_tecnologico','tienda_alameda','tienda_jardines'], recovery: false },
  { n: 4, port: '27020', stores: 'Réplica global de todas las sucursales', keys: [], recovery: true },
]

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { theme } = useTheme()
  const isGerente = user?.role === 'gerente'

  const [tiendas, setTiendas] = useState<any[]>([])
  const [resumen, setResumen] = useState<any[]>([])
  const [ventasDia, setVentasDia] = useState<any[]>([])
  const [ventasDiaNodosCaidos, setVentasDiaNodosCaidos]   = useState<number[]>([])
  const [ventasDiaNodosRespaldo, setVentasDiaNodosRespaldo] = useState<number[]>([])
  const [topProds, setTopProds] = useState<any[]>([])
  const [invBajo, setInvBajo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Selector de tienda para "Ingresos diarios" (admin)
  const [tiendaSel, setTiendaSel] = useState<string>('__global__')

  // Estado de nodos
  const [nodos, setNodos] = useState<Record<string, NodeStatus>>({
    nodo1: 'checking', nodo2: 'checking', nodo3: 'checking', nodo4: 'checking',
  })

  const fetchHealth = () => {
    api.get('/health').then(r => {
      const n = r.data?.nodos || {}
      setNodos({
        nodo1: String(n.nodo1).startsWith('OK') ? 'OK' : 'ERROR',
        nodo2: String(n.nodo2).startsWith('OK') ? 'OK' : 'ERROR',
        nodo3: String(n.nodo3).startsWith('OK') ? 'OK' : 'ERROR',
        nodo4: String(n.nodo4).startsWith('OK') ? 'OK' : 'ERROR',
      })
    }).catch(() => setNodos({ nodo1: 'ERROR', nodo2: 'ERROR', nodo3: 'ERROR', nodo4: 'ERROR' }))
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 30_000)
    return () => clearInterval(id)
  }, [])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: theme.surface, border: `1px solid rgba(255,255,255,.12)`, borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}>
        {label && <p style={{ color: theme.textMuted, marginBottom: 4, fontSize: 11 }}>{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: theme.text, fontWeight: 600 }}>
            <span style={{ color: p.fill || theme.accent }}>●</span>{' '}
            {p.name}: <span style={{ color: theme.text }}>{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    )
  }

  const UnitTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: theme.surface, border: `1px solid rgba(255,255,255,.12)`, borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}>
        {label && <p style={{ color: theme.textMuted, marginBottom: 4, fontSize: 11 }}>{label}</p>}
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: theme.text, fontWeight: 600 }}>
            <span style={{ color: p.fill || theme.accent }}>●</span>{' '}{p.value} unidades
          </p>
        ))}
      </div>
    )
  }

  const load = async () => {
    setLoading(true)
    try {
      const tiendaKey = user?.tienda || 'tienda_centro'
      if (isAdmin) {
        const [tR, rR] = await Promise.allSettled([
          api.get('/tiendas/'),
          api.get('/reportes/resumen-global'),
        ])
        if (tR.status === 'fulfilled') setTiendas(tR.value.data)
        if (rR.status === 'fulfilled') setResumen(rR.value.data)
        // cargar ingresos diarios según selector
        await loadVentasDia(tiendaSel)
      } else {
        const [diasR, prodsR, invR] = await Promise.allSettled([
          api.get(`/reportes/ventas-por-dia/${tiendaKey}`),
          api.get(`/reportes/productos-mas-vendidos/${tiendaKey}?limit=5`),
          api.get(`/reportes/inventario-bajo/${tiendaKey}?umbral=10`),
        ])
        if (diasR.status === 'fulfilled') setVentasDia(diasR.value.data.slice(-14))
        if (prodsR.status === 'fulfilled') setTopProds(prodsR.value.data)
        if (invR.status === 'fulfilled') setInvBajo(invR.value.data)
      }
      setLastUpdate(new Date())
    } catch { }
    setLoading(false)
  }

  const loadVentasDia = async (sel: string) => {
    setVentasDiaNodosCaidos([])
    setVentasDiaNodosRespaldo([])
    try {
      if (sel === '__global__') {
        const { data } = await api.get('/reportes/ventas-por-dia-global')
        setVentasDia((data.data || []).slice(-14))
        setVentasDiaNodosCaidos(data.nodos_caidos || [])
        setVentasDiaNodosRespaldo(data.nodos_respaldo || [])
      } else {
        const { data } = await api.get(`/reportes/ventas-por-dia/${sel}`)
        const arr = Array.isArray(data) ? data : (data.data || [])
        setVentasDia(arr.slice(-14))
        if (arr[0]?.desde_respaldo) setVentasDiaNodosRespaldo([TIENDA_NODO[sel]])
      }
    } catch (e: any) {
      if (e.response?.status === 503) {
        const nodo = TIENDA_NODO[sel]
        setVentasDiaNodosCaidos([nodo])
      }
      setVentasDia([])
    }
  }

  useEffect(() => { load() }, [])

  // Cuando cambia el selector de tienda, recarga solo esa parte
  useEffect(() => {
    if (!isAdmin) return
    loadVentasDia(tiendaSel)
  }, [tiendaSel])

  const totalVentas = resumen.reduce((a, b) => a + (b.total_ventas || 0), 0)
  const totalIngresos = resumen.reduce((a, b) => a + (b.total_ingresos || 0), 0)
  const top5 = [...resumen].sort((a, b) => b.total_ingresos - a.total_ingresos).slice(0, 5)
  const ventasDiaTotales = ventasDia.reduce((a, b) => a + (b.ingresos || 0), 0)

  const mitad = Math.floor(ventasDia.length / 2)
  const reciente = ventasDia.slice(mitad).reduce((a,b) => a + (b.ingresos||0), 0)
  const anterior = ventasDia.slice(0, mitad).reduce((a,b) => a + (b.ingresos||0), 0)
  const trendPct = anterior > 0 ? ((reciente - anterior) / anterior * 100).toFixed(1) : null
  const trendStr = trendPct ? `${parseFloat(trendPct) >= 0 ? '+' : ''}${trendPct}%` : undefined

  // Solo contar nodos 1-3 como error crítico; el 4 es de respaldo
  const nodosConError = Object.entries(nodos)
    .filter(([k, v]) => v === 'ERROR' && k !== 'nodo4')
    .map(([k]) => parseInt(k.replace('nodo','')))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '.78rem', marginBottom: 2 }}>
            {greeting()}, <strong style={{ color: 'var(--accent)' }}>{user?.nombre?.split(' ')[0]}</strong>
          </p>
          <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.78rem', marginTop: 2 }}>
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {isGerente && user?.tienda && (
              <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>
                · {TIENDA_NOMBRES[user.tienda] || user.tienda}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="btn btn-secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
          {lastUpdate && (
            <p style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>
              Actualizado {lastUpdate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* ── Banner nodos caídos ── */}
      {nodosConError.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          borderRadius: 8, background: 'var(--warning-bg)', border: '1px solid var(--warning)',
        }}>
          <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
          <p style={{ color: 'var(--warning)', fontSize: '.82rem', fontWeight: 600 }}>
            Nodo{nodosConError.length > 1 ? 's' : ''} {nodosConError.join(' y ')} fuera de línea —
            las sucursales afectadas muestran datos parciales o no disponibles.
          </p>
        </div>
      )}

      {/* ── Nodos (admin) ── */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          {NODE_INFO.map(({ n, port, stores, recovery }) => {
            const key = `nodo${n}` as keyof typeof nodos
            const status = nodos[key]
            const isOk = status === 'OK'
            const isChecking = status === 'checking'

            const color     = isChecking ? 'var(--text-muted)' : isOk ? (recovery ? 'var(--accent)' : 'var(--success)') : recovery ? 'var(--warning)' : 'var(--danger)'
            const colorBg   = isChecking ? 'var(--surface2)'   : isOk ? (recovery ? 'var(--accent-bg)' : 'var(--success-bg)') : recovery ? 'rgba(210,153,34,.1)' : 'var(--danger-bg)'
            const colorBdr  = isChecking ? 'var(--border)'     : isOk ? (recovery ? 'var(--accent-border)' : 'rgba(63,185,80,.5)') : recovery ? 'rgba(210,153,34,.5)' : 'rgba(248,81,73,.5)'

            return (
              <div key={n} style={{
                borderRadius: 14, overflow: 'hidden',
                border: `1px solid ${colorBdr}`,
                background: colorBg,
                boxShadow: isOk && !isChecking ? `0 0 0 1px ${colorBdr}, 0 4px 16px ${color}18` : 'none',
                transition: 'all .35s',
              }}>
                {/* Barra superior de color */}
                <div style={{
                  height: 4,
                  background: isChecking
                    ? 'var(--border)'
                    : `linear-gradient(90deg, ${color}, ${color}88)`,
                }} />

                <div style={{ padding: '14px 16px' }}>
                  {/* Fila superior: ícono + nombre + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    {/* Ícono con círculo */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isChecking ? 'var(--surface)' : `${color}20`,
                      border: `2px solid ${isChecking ? 'var(--border)' : color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      {isChecking
                        ? <Loader size={14} color="var(--text-muted)" className="spin" />
                        : isOk
                          ? <>
                              {recovery
                                ? <ShieldCheck size={15} color={color} />
                                : <Wifi size={15} color={color} />
                              }
                              <span style={{
                                position: 'absolute', top: 0, right: 0, width: 9, height: 9,
                                borderRadius: '50%', background: color,
                                border: '2px solid var(--surface)',
                                animation: 'ping 1.8s cubic-bezier(0,0,.2,1) infinite',
                                opacity: .6,
                              }} />
                              <span style={{
                                position: 'absolute', top: 0, right: 0, width: 9, height: 9,
                                borderRadius: '50%', background: color,
                                border: '2px solid var(--surface)',
                              }} />
                            </>
                          : <WifiOff size={15} color={color} />
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <p style={{ color: 'var(--text-h)', fontSize: '.88rem', fontWeight: 800 }}>
                          Nodo {n}
                        </p>
                        <code style={{ color: 'var(--text-muted)', fontSize: '.62rem' }}>:{port}</code>
                      </div>
                      {recovery && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <ShieldCheck size={9} color="var(--accent)" />
                          <span style={{ color: 'var(--accent)', fontSize: '.62rem', fontWeight: 700 }}>Recuperación global</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badge de estado */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8,
                    background: isChecking ? 'var(--surface)' : `${color}14`,
                    border: `1px solid ${isChecking ? 'var(--border)' : `${color}30`}`,
                  }}>
                    <span style={{ color, fontSize: '.7rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {isChecking ? 'Verificando…' : isOk ? '● Online' : '○ Offline'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>
                      {stores.split(' · ').length} {recovery ? 'copias' : 'tiendas'}
                    </span>
                  </div>

                  {/* Sucursales */}
                  <p style={{
                    color: 'var(--text-muted)', fontSize: '.65rem', marginTop: 8,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    opacity: .85,
                  }}>
                    {stores}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Stats globales (admin) ── */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard icon={Store}        label="Sucursales"        value={tiendas.length || 10}                       sub="En 3 nodos"      color="#58a6ff" />
          <StatCard icon={ShoppingCart} label="Ventas totales"    value={totalVentas.toLocaleString()}               sub="Nodos activos"   trend={trendStr} color="#a78bfa" />
          <StatCard icon={DollarSign}   label="Ingresos totales"  value={fmt(totalIngresos)}                         sub="IVA incluido"    trend={trendStr} color="#3fb950" />
          <StatCard icon={TrendingUp}   label="Promedio / tienda" value={fmt(totalIngresos / (resumen.filter(r => r.nodo_activo).length || 1))} sub="Nodos activos" color="#f0883e" />
        </div>
      )}

      {/* ── Stats gerente ── */}
      {isGerente && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard icon={DollarSign}  label="Ingresos 14 días"  value={fmt(ventasDiaTotales)}  sub="Tu sucursal" trend={trendStr} color="#3fb950" />
          <StatCard icon={BarChart2}   label="Más vendido"       value={topProds[0]?.producto || '—'} sub="Top producto" color="#a78bfa" />
          <StatCard icon={Package}     label="Stock crítico"      value={invBajo.length}         sub="≤ 10 unidades" color="#f0883e" />
        </div>
      )}

      {/* ── Gráficas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '3fr 2fr' : '1fr', gap: 16 }}>

        {/* ══ Ingresos diarios ══ */}
        <div style={{
          borderRadius: 16, border: '1px solid var(--border)',
          background: 'var(--surface)', overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,.08)',
        }}>
          {/* Header con degradado */}
          <div style={{
            padding: '16px 20px',
            background: `linear-gradient(135deg, ${theme.accent}12 0%, transparent 100%)`,
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${theme.accent}20`, border: `1px solid ${theme.accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <TrendingUp size={13} color={theme.accent} />
                  </div>
                  <p style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.95rem' }}>Ingresos diarios</p>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '.73rem', marginLeft: 36 }}>
                  Últimos 14 días ·{' '}
                  <span style={{ color: theme.accent, fontWeight: 600 }}>
                    {isAdmin
                      ? tiendaSel === '__global__' ? 'Todas las sucursales' : TIENDA_NOMBRES[tiendaSel]
                      : TIENDA_NOMBRES[user?.tienda || 'tienda_centro']
                    }
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {trendStr && ventasDia.length > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: 8,
                    background: parseFloat(trendStr) >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${parseFloat(trendStr) >= 0 ? 'rgba(63,185,80,.3)' : 'rgba(248,81,73,.3)'}`,
                    color: parseFloat(trendStr) >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {parseFloat(trendStr) >= 0 ? '↑' : '↓'} {trendStr} vs ant.
                  </span>
                )}
                {isAdmin && (
                  <div style={{ position: 'relative' }}>
                    <select
                      value={tiendaSel}
                      onChange={e => setTiendaSel(e.target.value)}
                      style={{ width: 'auto', paddingRight: 28, appearance: 'none', fontSize: '.78rem' }}
                    >
                      <option value="__global__">Todas las sucursales</option>
                      {TIENDAS_ALL.map(k => (
                        <option key={k} value={k} disabled={nodos[`nodo${TIENDA_NODO[k]}`] === 'ERROR'}>
                          {TIENDA_NOMBRES[k]}{nodos[`nodo${TIENDA_NODO[k]}`] === 'ERROR' ? ' (caída)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                  </div>
                )}
              </div>
            </div>

            {ventasDiaNodosRespaldo.length > 0 && ventasDiaNodosCaidos.length === 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
                padding: '6px 10px', borderRadius: 7,
                background: '#58a6ff12', border: '1px solid #58a6ff40',
              }}>
                <ShieldCheck size={11} color="#58a6ff" />
                <p style={{ color: '#58a6ff', fontSize: '.71rem' }}>
                  Nodo{ventasDiaNodosRespaldo.length > 1 ? 's' : ''} {ventasDiaNodosRespaldo.join(', ')} caído{ventasDiaNodosRespaldo.length > 1 ? 's' : ''} — datos recuperados desde nodo de respaldo
                </p>
              </div>
            )}
            {ventasDiaNodosCaidos.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
                padding: '6px 10px', borderRadius: 7,
                background: 'var(--warning-bg)', border: '1px solid rgba(210,153,34,.3)',
              }}>
                <AlertTriangle size={11} color="var(--warning)" />
                <p style={{ color: 'var(--warning)', fontSize: '.71rem' }}>
                  Nodo{ventasDiaNodosCaidos.length > 1 ? 's' : ''} {ventasDiaNodosCaidos.join(', ')} sin datos — ingresos parciales
                </p>
              </div>
            )}
          </div>

          {/* Gráfica */}
          <div style={{ padding: '16px 20px 12px' }}>
            {loading ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>
                  <RefreshCw size={16} className="spin" style={{ display: 'block', margin: '0 auto 8px' }} />
                  Consultando nodos...
                </div>
              </div>
            ) : ventasDia.length === 0 ? (
              <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <WifiOff size={24} color="var(--danger)" />
                <p style={{ color: 'var(--danger)', fontSize: '.82rem', fontWeight: 600 }}>Nodo fuera de línea</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>Sin datos disponibles</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={ventasDia} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={theme.accent} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={theme.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fill: theme.textMuted, fontSize: 10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.textMuted, fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={theme.accent} strokeWidth={2.5} fill="url(#ag)" dot={false} activeDot={{ r: 5, fill: theme.accent, stroke: 'var(--surface)', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ══ Top 5 sucursales ══ */}
        {isAdmin && (
          <div style={{
            borderRadius: 16, border: '1px solid var(--border)',
            background: 'var(--surface)', overflow: 'hidden',
            boxShadow: '0 2px 16px rgba(0,0,0,.08)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, rgba(167,139,250,.1) 0%, transparent 100%)',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(167,139,250,.18)', border: '1px solid rgba(167,139,250,.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BarChart2 size={13} color="#a78bfa" />
                </div>
                <div>
                  <p style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.95rem' }}>Top 5 sucursales</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>Por ingresos totales · nodos activos</p>
                </div>
              </div>
            </div>

            {/* Lista */}
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading ? (
                <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={16} className="spin" color={theme.textMuted} />
                </div>
              ) : top5.map((t, i) => {
                const max    = top5[0]?.total_ingresos || 1
                const pct    = (t.total_ingresos / max) * 100
                const nombre = t.tienda_nombre?.replace('NovaPOS ','').replace('OXXO ','') || t.tienda_key
                const isDown = t.nodo_activo === false
                const RANK_COLORS = ['#f0883e','#a78bfa','#58a6ff','#3fb950','var(--text-muted)']
                const rankColor = isDown ? 'var(--danger)' : RANK_COLORS[i] || 'var(--text-muted)'
                return (
                  <div key={t.tienda_key} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: i === 0 && !isDown ? `${RANK_COLORS[0]}0d` : 'var(--surface2)',
                    border: `1px solid ${i === 0 && !isDown ? `${RANK_COLORS[0]}30` : 'var(--border)'}`,
                    transition: 'all .2s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Número con color */}
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: isDown ? 'var(--danger-bg)' : `${rankColor}20`,
                          border: `1px solid ${isDown ? 'var(--danger)' : `${rankColor}50`}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isDown ? 'var(--danger)' : rankColor,
                          fontSize: '.65rem', fontWeight: 900,
                        }}>{i + 1}</div>
                        <span style={{ color: isDown ? 'var(--text-muted)' : 'var(--text-h)', fontSize: '.8rem', fontWeight: 700 }}>{nombre}</span>
                        {isDown && <span className="badge badge-danger" style={{ fontSize: '.56rem' }}>caída</span>}
                        {!isDown && t.desde_respaldo && <span className="badge badge-warning" style={{ fontSize: '.56rem' }}>⚡ respaldo</span>}
                      </div>
                      <span style={{ color: isDown ? 'var(--text-muted)' : rankColor, fontSize: '.82rem', fontWeight: 800 }}>
                        {fmtK(t.total_ingresos)}
                      </span>
                    </div>
                    {/* Barra */}
                    <div style={{ height: 5, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${pct}%`,
                        background: isDown ? 'var(--danger)' : `linear-gradient(90deg, ${rankColor}, ${rankColor}88)`,
                        transition: 'width .7s cubic-bezier(.16,1,.3,1)',
                        opacity: isDown ? 0.3 : 1,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top productos — gerente */}
        {isGerente && topProds.length > 0 && (
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem', marginBottom: 14 }}>Top productos vendidos</p>
            {loading ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={16} className="spin" color={theme.textMuted} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topProds} layout="vertical" margin={{ right: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: theme.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="producto" type="category" tick={{ fill: theme.text, fontSize: 9 }} width={110}
                    tickFormatter={v => v.length > 15 ? v.slice(0,15)+'…' : v} axisLine={false} tickLine={false} />
                  <Tooltip content={<UnitTooltip />} />
                  <Bar dataKey="cantidad" fill={theme.accent} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="cantidad" position="right" style={{ fill: theme.textMuted, fontSize: 10, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* ── Stock crítico (gerente) ── */}
      {isGerente && invBajo.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color="var(--warning)" />
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem' }}>Stock crítico en tu sucursal</p>
            <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{invBajo.length} productos</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {invBajo.slice(0, 8).map((p, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{p.nombre}</td>
                  <td><span className="badge badge-muted">{p.categoria}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`badge ${p.stock <= 5 ? 'badge-danger' : 'badge-warning'}`}>{p.stock}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tabla de sucursales (admin) ── */}
      {isAdmin && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem' }}>Estado de sucursales</p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {nodosConError.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '.68rem' }}>
                  Nodo{nodosConError.length > 1 ? 's' : ''} {nodosConError.join(', ')} caído{nodosConError.length > 1 ? 's' : ''}
                </span>
              )}
              <span className="badge badge-muted">{resumen.length} sucursales</span>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Sucursal</th>
                <th>Nodo</th>
                <th style={{ textAlign: 'right' }}>Ventas</th>
                <th style={{ textAlign: 'right' }}>Ingresos</th>
                <th style={{ textAlign: 'right' }}>Participación</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((t, i) => {
                const isDown = t.nodo_activo === false
                return (
                  <tr key={t.tienda_key} style={{ opacity: isDown ? 0.5 : 1 }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '.75rem', width: 32 }}>{i+1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: isDown ? 'var(--text-muted)' : 'var(--text-h)', fontWeight: 500 }}>
                          {TIENDA_NOMBRES[t.tienda_key] || t.tienda_nombre}
                        </span>
                        {isDown && <span className="badge badge-danger" style={{ fontSize: '.6rem' }}>fuera de línea</span>}
                        {!isDown && t.desde_respaldo && <span className="badge badge-warning" style={{ fontSize: '.6rem' }}>⚡ respaldo</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isDown ? 'badge-danger' : 'badge-accent'}`}>
                        Nodo {t.nodo}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text)' }}>{(t.total_ventas || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: isDown ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 700 }}>
                      {isDown ? '—' : fmt(t.total_ingresos)}
                    </td>
                    <td style={{ textAlign: 'right', width: 100 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{ width: 50, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: isDown ? 'var(--danger)' : 'var(--accent)',
                            width: `${totalIngresos > 0 ? (t.total_ingresos / totalIngresos * 100) : 0}%`,
                            opacity: isDown ? 0.3 : 1,
                          }} />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '.72rem', minWidth: 30 }}>
                          {totalIngresos > 0 ? (t.total_ingresos / totalIngresos * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
