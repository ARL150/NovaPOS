import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import {
  ShieldCheck, RefreshCw, CheckCircle, XCircle, Clock,
  AlertTriangle, Database, ShoppingCart, Package, Users, UserCircle,
  Wifi, WifiOff, Zap, ArrowDownToLine, GitMerge, RotateCcw,
} from 'lucide-react'

const COL_ICON: Record<string, any> = {
  productos: Package, ventas: ShoppingCart,
  usuarios: Users, clientes: UserCircle,
}
const COL_COLOR: Record<string, string> = {
  productos: '#58a6ff', ventas: '#3fb950',
  usuarios: '#d29922', clientes: '#a78bfa',
}

const NODOS = [
  {
    n: 1, port: '27017', color: '#3fb950',
    primarias: ['OXXO Centro', 'OXXO Norte'],
    respaldaDe: 3,
    respaldos: ['OXXO Universidad', 'OXXO Insurgentes', 'OXXO Tecnológico', 'OXXO Alameda', 'OXXO Jardines'],
  },
  {
    n: 2, port: '27018', color: '#a78bfa',
    primarias: ['OXXO Sur', 'OXXO Este', 'OXXO Oeste'],
    respaldaDe: 1,
    respaldos: ['OXXO Centro', 'OXXO Norte'],
  },
  {
    n: 3, port: '27019', color: '#f0883e',
    primarias: ['OXXO Universidad', 'OXXO Insurgentes', 'OXXO Tecnológico', 'OXXO Alameda', 'OXXO Jardines'],
    respaldaDe: 2,
    respaldos: ['OXXO Sur', 'OXXO Este', 'OXXO Oeste'],
  },
]

function fmtNum(n: number) { return new Intl.NumberFormat('es-MX').format(n) }
function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })
}
function fmtCountdown(s: number | null) {
  if (s === null) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return `${m}m ${sec}s`
}

export default function Nodo4() {
  const [nodoInfo, setNodoInfo]   = useState<any>(null)
  const [estado, setEstado]       = useState<any>(null)
  const [loadingN, setLoadingN]   = useState(true)
  const [loadingE, setLoadingE]   = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [tab, setTab]             = useState<'estado' | 'topologia' | 'datos'>('estado')

  const loadNodo = useCallback(() => {
    setLoadingN(true)
    api.get('/sync/nodo4/nodo').then(r => setNodoInfo(r.data)).finally(() => setLoadingN(false))
  }, [])

  const loadEstado = useCallback(() => {
    setLoadingE(true)
    api.get('/sync/nodo4/estado').then(r => {
      setEstado(r.data)
      setCountdown(r.data.segundos_para_sync ?? null)
    }).finally(() => setLoadingE(false))
  }, [])

  useEffect(() => {
    loadNodo(); loadEstado()
    const id = setInterval(() => { loadEstado() }, 10_000)
    return () => clearInterval(id)
  }, [loadNodo, loadEstado])

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setInterval(() => setCountdown(c => (c !== null && c > 0) ? c - 1 : 0), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const triggerSync = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      await api.post('/sync/nodo4')
      setSyncMsg({ ok: true, text: 'Sincronización iniciada correctamente.' })
      setTimeout(() => { loadNodo(); loadEstado() }, 3000)
    } catch (e: any) {
      setSyncMsg({ ok: false, text: e.response?.data?.detail || 'Error al iniciar sync.' })
    } finally { setSyncing(false) }
  }

  const activo      = nodoInfo?.activo ?? false
  const enProgreso  = estado?.en_progreso ?? false
  const totalDocs   = nodoInfo?.total_docs ?? 0

  const TABS = [
    { id: 'estado',    label: 'Estado de sync',   icon: Clock },
    { id: 'topologia', label: 'Mapa de réplicas',  icon: GitMerge },
    { id: 'datos',     label: 'Datos en Nodo 4',   icon: Database },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: activo ? '#58a6ff14' : 'var(--danger-bg)',
            border: `1px solid ${activo ? '#58a6ff50' : 'var(--danger)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {activo && <div style={{
              position: 'absolute', inset: -4, borderRadius: 17,
              background: '#58a6ff', opacity: .1,
              animation: 'ping 2s infinite',
            }} />}
            <ShieldCheck size={22} color={activo ? '#58a6ff' : 'var(--danger)'} />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-h)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 2 }}>
              Estado de Replicación
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>
              Anillo cruzado N1↔N2↔N3 · Réplica global en Nodo 4 · localhost:27020
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { loadNodo(); loadEstado() }} style={{ gap: 6 }}>
            <RefreshCw size={13} className={(loadingN || loadingE) ? 'spin' : ''} /> Actualizar
          </button>
          <button
            className="btn btn-primary"
            onClick={triggerSync}
            disabled={syncing || enProgreso || !activo}
            style={{ gap: 6, background: '#58a6ff', borderColor: '#58a6ff' }}
          >
            {syncing || enProgreso
              ? <><RefreshCw size={13} className="spin" /> Sincronizando…</>
              : <><ArrowDownToLine size={13} /> Sincronizar ahora</>}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8,
          background: syncMsg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${syncMsg.ok ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          {syncMsg.ok ? <CheckCircle size={14} color="var(--success)" /> : <XCircle size={14} color="var(--danger)" />}
          <p style={{ color: syncMsg.ok ? 'var(--success)' : 'var(--danger)', fontSize: '.82rem', fontWeight: 600 }}>{syncMsg.text}</p>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: activo ? Wifi : WifiOff, label: 'Nodo 4', value: activo ? 'Online' : 'Offline', color: activo ? '#3fb950' : 'var(--danger)', sub: ':27020' },
          { icon: Database,  label: 'Docs replicados', value: loadingN ? '…' : fmtNum(totalDocs), color: '#58a6ff', sub: '10 bases de datos' },
          { icon: Clock,     label: 'Próximo sync',    value: enProgreso ? 'En curso…' : fmtCountdown(countdown), color: '#d29922', sub: `Cada ${estado?.intervalo_minutos ?? 5} min` },
          { icon: Zap,       label: 'Syncs totales',   value: estado?.total_syncs ?? 0, color: '#a78bfa', sub: `Último: ${fmtTime(estado?.ultimo_sync)}` },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} style={{
            borderRadius: 12, border: `1px solid ${color}30`,
            background: `${color}08`, padding: '14px 16px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${color},${color}55)`, borderRadius: '12px 12px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3 }}>{label}</p>
                <p style={{ color, fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{String(value)}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '.63rem', marginTop: 4 }}>{sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
              background: tab === id ? 'var(--surface)' : 'transparent',
              color: tab === id ? '#58a6ff' : 'var(--text-muted)',
              borderBottom: tab === id ? '2px solid #58a6ff' : '2px solid transparent',
              transition: 'all .15s',
            }}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Estado de sync ── */}
      {tab === 'estado' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Timeline de sync */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={14} color="#58a6ff" /> Sincronización automática
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Último sync completado', value: fmtTime(estado?.ultimo_sync), ok: !!estado?.ultimo_sync },
                { label: 'Intervalo automático',   value: `Cada ${estado?.intervalo_minutos ?? 5} minutos`, ok: true },
                { label: 'Próximo sync en',        value: enProgreso ? '⏳ En progreso…' : fmtCountdown(countdown), ok: !enProgreso },
                { label: 'Errores consecutivos',   value: String(estado?.errores_consecutivos ?? 0), ok: (estado?.errores_consecutivos ?? 0) === 0 },
                { label: 'Total sincronizaciones', value: String(estado?.total_syncs ?? 0), ok: true },
              ].map(({ label, value, ok }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 7, border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>{label}</span>
                  <span style={{ color: ok ? 'var(--text-h)' : 'var(--danger)', fontSize: '.76rem', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
            {enProgreso && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 12px', background: '#58a6ff12', border: '1px solid #58a6ff40', borderRadius: 8 }}>
                <RefreshCw size={12} color="#58a6ff" className="spin" />
                <p style={{ color: '#58a6ff', fontSize: '.76rem', fontWeight: 600 }}>Sincronización en progreso…</p>
              </div>
            )}
            {!enProgreso && (estado?.errores_consecutivos ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 8 }}>
                <AlertTriangle size={12} color="var(--warning)" />
                <p style={{ color: 'var(--warning)', fontSize: '.76rem', fontWeight: 600 }}>
                  {estado.errores_consecutivos} error(es) en el último sync
                </p>
              </div>
            )}
          </div>

          {/* Colecciones en nodo 4 */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck size={14} color="#58a6ff" /> Contenido en Nodo 4
              <span className={`badge ${activo ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 'auto', fontSize: '.6rem' }}>
                {activo ? '● Online' : '○ Offline'}
              </span>
            </p>
            {!activo ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <WifiOff size={32} style={{ opacity: .2, display: 'block', margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>Nodo 4 no disponible</p>
                <code style={{ display: 'inline-block', marginTop: 8, padding: '5px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.72rem', color: 'var(--accent)' }}>
                  docker-compose up -d mongo-nodo4
                </code>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['productos', 'ventas', 'clientes', 'usuarios'] as const).map(col => {
                  const Icon  = COL_ICON[col]
                  const color = COL_COLOR[col]
                  const total = loadingN ? 0 : (nodoInfo?.bases || []).reduce((s: number, b: any) => s + (b.colecciones?.[col] ?? 0), 0)
                  const maxCol = { productos: 2201, ventas: 3005, clientes: 2500, usuarios: 30 }[col] || 1
                  const pct    = Math.min(100, Math.round(total / maxCol * 100))
                  return (
                    <div key={col} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: `1px solid ${color}25` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Icon size={13} color={color} />
                          <span style={{ color: 'var(--text)', fontSize: '.78rem', fontWeight: 600, textTransform: 'capitalize' }}>{col}</span>
                        </div>
                        <span style={{ color, fontWeight: 800, fontSize: '.82rem', fontFamily: 'monospace' }}>{loadingN ? '…' : fmtNum(total)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}88)`, borderRadius: 2, transition: 'width .4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Mapa de réplicas ── */}
      {tab === 'topologia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Anillo visual */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
              <GitMerge size={14} color="#58a6ff" /> Anillo de respaldo cruzado
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginBottom: 16 }}>
              Cada nodo almacena una copia (bkp_*) del nodo anterior. Si cualquiera cae, el sistema sirve desde el respaldo sin interrupción.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', rowGap: 12 }}>
              {NODOS.map((nd, i) => (
                <div key={nd.n} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: `${nd.color}18`, border: `2.5px solid ${nd.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '1rem', color: nd.color,
                    }}>N{nd.n}</div>
                    <p style={{ color: nd.color, fontSize: '.72rem', fontWeight: 700 }}>Nodo {nd.n}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontFamily: 'monospace' }}>:{nd.port}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                      {nd.primarias.map(p => (
                        <span key={p} style={{ fontSize: '.58rem', color: nd.color, background: `${nd.color}14`, padding: '1px 6px', borderRadius: 4, border: `1px solid ${nd.color}30` }}>{p}</span>
                      ))}
                    </div>
                  </div>
                  {i < NODOS.length - 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px' }}>
                      <div style={{ width: 40, height: 2, background: 'var(--border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', right: -4, top: -4, width: 0, height: 0, borderLeft: '8px solid var(--border)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '.6rem', marginTop: 4 }}>respaldo</span>
                    </div>
                  )}
                </div>
              ))}
              {/* Flecha de cierre N3 → N1 */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 40, height: 2, background: 'var(--border)', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: -4, top: -4, width: 0, height: 0, borderLeft: '8px solid var(--border)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.6rem', marginTop: 4 }}>→ N1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas de nodo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {NODOS.map(nd => (
              <div key={nd.n} style={{ borderRadius: 12, border: `1px solid ${nd.color}35`, overflow: 'hidden' }}>
                <div style={{ height: 3, background: `linear-gradient(90deg,${nd.color},${nd.color}55)` }} />
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${nd.color}20`, background: `${nd.color}08`, display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: `${nd.color}18`, border: `2px solid ${nd.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, color: nd.color, fontSize: '.85rem',
                  }}>N{nd.n}</div>
                  <div>
                    <p style={{ color: nd.color, fontWeight: 800, fontSize: '.85rem' }}>Nodo {nd.n}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontFamily: 'monospace' }}>localhost:{nd.port}</p>
                  </div>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: nd.color }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>Bases primarias</p>
                    </div>
                    {nd.primarias.map(p => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 3, borderRadius: 6, background: `${nd.color}0d`, border: `1px solid ${nd.color}25` }}>
                        <Database size={10} color={nd.color} />
                        <span style={{ color: 'var(--text)', fontSize: '.74rem' }}>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <ShieldCheck size={10} color="var(--text-muted)" />
                      <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                        Respaldo de Nodo {nd.respaldaDe}
                      </p>
                    </div>
                    {nd.respaldos.map(r => (
                      <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', marginBottom: 3, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                        <RotateCcw size={9} color="var(--text-muted)" />
                        <span style={{ color: 'var(--text-muted)', fontSize: '.74rem' }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nodo 4 */}
          <div style={{ borderRadius: 12, border: '1px solid #58a6ff40', overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#58a6ff,#a78bfa)' }} />
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #58a6ff20', background: '#58a6ff08', display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldCheck size={20} color="#58a6ff" />
              <div style={{ flex: 1 }}>
                <p style={{ color: '#58a6ff', fontWeight: 800, fontSize: '.9rem' }}>
                  Nodo 4 — Réplica Global <code style={{ fontWeight: 400, fontSize: '.72rem', opacity: .7, marginLeft: 6 }}>localhost:27020</code>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>
                  Recibe copia de las 10 tiendas cada 5 min · último recurso si caen nodos 1, 2 y 3 simultáneamente
                </p>
              </div>
              <span className={`badge ${activo ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '.62rem' }}>
                {activo ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['tienda_centro','tienda_norte','tienda_sur','tienda_este','tienda_oeste',
                'tienda_universidad','tienda_insurgentes','tienda_tecnologico','tienda_alameda','tienda_jardines',
              ].map(k => (
                <code key={k} style={{ padding: '4px 9px', borderRadius: 6, fontSize: '.67rem', background: '#58a6ff12', border: '1px solid #58a6ff30', color: '#58a6ff' }}>
                  global_{k}
                </code>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Datos en Nodo 4 ── */}
      {tab === 'datos' && (
        activo && nodoInfo?.bases?.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={14} color="#58a6ff" />
              <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.85rem' }}>Bases de datos en Nodo 4</p>
              <span className="badge badge-muted" style={{ fontSize: '.62rem', marginLeft: 4 }}>{nodoInfo.bases.length} bases</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '.7rem' }}>
                Total: <b style={{ color: 'var(--text-h)' }}>{fmtNum(totalDocs)}</b> documentos
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Base de datos</th>
                    {['productos','ventas','clientes','usuarios'].map(c => (
                      <th key={c} style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {(() => { const I = COL_ICON[c]; return <I size={11} color={COL_COLOR[c]} /> })()}
                          {c}
                        </span>
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {nodoInfo.bases.map((base: any) => {
                    const rowTotal = (['productos','ventas','clientes','usuarios'] as const)
                      .reduce((s, c) => s + (base.colecciones?.[c] ?? 0), 0)
                    return (
                      <tr key={base.nombre}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Database size={11} color="#58a6ff" />
                            <div>
                              <code style={{ fontSize: '.72rem', color: '#58a6ff', display: 'block' }}>{base.nombre}</code>
                              <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>
                                {base.tienda_key?.replace('tienda_', '').replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </td>
                        {(['productos','ventas','clientes','usuarios'] as const).map(c => (
                          <td key={c} style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '.78rem', color: COL_COLOR[c] }}>
                            {fmtNum(base.colecciones?.[c] ?? 0)}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '.82rem', color: 'var(--text-h)', fontFamily: 'monospace' }}>
                          {fmtNum(rowTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <WifiOff size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: .2 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', fontWeight: 700, marginBottom: 6 }}>Nodo 4 no disponible</p>
            <code style={{ display: 'inline-block', marginTop: 8, padding: '6px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: '.75rem', color: 'var(--accent)' }}>
              docker-compose up -d mongo-nodo4
            </code>
          </div>
        )
      )}
    </div>
  )
}
