import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Store, MapPin, Server, ShoppingCart, Package, DollarSign, Wifi, WifiOff, Loader, AlertTriangle } from 'lucide-react'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const NODE_PORTS: Record<number, string> = { 1: '27017', 2: '27018', 3: '27019' }

export default function Tiendas() {
  const [tiendas, setTiendas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get('/tiendas/')
      .then(r => setTiendas(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const byNodo = [1, 2, 3].map(n => ({
    n,
    port: NODE_PORTS[n],
    items: tiendas.filter(t => t.nodo === n),
    activo: tiendas.filter(t => t.nodo === n).some(t => t.nodo_activo !== false),
  }))

  const nodosActivos = byNodo.filter(n => n.activo).length
  const nodosCaidos = byNodo.filter(n => !n.activo && n.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Tiendas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: 2 }}>
            10 sucursales distribuidas · {nodosActivos}/3 nodos en línea
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setLoading(true); setError(false); api.get('/tiendas/').then(r => setTiendas(r.data)).catch(() => setError(true)).finally(() => setLoading(false)) }} style={{ gap: 6 }}>
          <Loader size={13} className={loading ? 'spin' : ''} />
          Refrescar
        </button>
      </div>

      {/* ── Banner nodos caídos ── */}
      {!loading && nodosCaidos.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
          borderRadius: 8, background: 'var(--warning-bg)', border: '1px solid var(--warning)',
        }}>
          <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '.85rem' }}>
              {nodosCaidos.length === 1 ? 'Un nodo fuera de línea' : `${nodosCaidos.length} nodos fuera de línea`}
            </p>
            <p style={{ color: 'var(--warning)', fontSize: '.78rem', opacity: .85, marginTop: 2 }}>
              Nodo{nodosCaidos.length > 1 ? 's' : ''} {nodosCaidos.map(n => n.n).join(' y ')} no responden.
              Las sucursales afectadas se muestran deshabilitadas. Los demás nodos funcionan con normalidad.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: '.85rem', padding: '20px 0' }}>
          <Loader size={16} className="spin" />
          Consultando nodos MongoDB...
        </div>
      ) : error ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '16px',
          borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger)',
        }}>
          <WifiOff size={16} color="var(--danger)" />
          <p style={{ color: 'var(--danger)', fontSize: '.85rem', fontWeight: 600 }}>
            No se pudo conectar con el servidor. Verifica que el backend esté activo.
          </p>
        </div>
      ) : byNodo.map(({ n, port, items, activo }) => (
        <div key={n}>
          {/* ── Encabezado de nodo ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Server size={13} color={activo ? 'var(--text-muted)' : 'var(--danger)'} />
            <span style={{
              color: activo ? 'var(--text-muted)' : 'var(--danger)',
              fontSize: '.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
            }}>
              Nodo {n}
            </span>
            <span className="badge badge-muted" style={{ fontSize: '.62rem' }}>{port}</span>

            {activo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--success)',
                  animation: 'pulse 2s ease-in-out infinite', flexShrink: 0,
                }} />
                <Wifi size={11} color="var(--success)" />
                <span style={{ color: 'var(--success)', fontSize: '.72rem', fontWeight: 600 }}>En línea</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <WifiOff size={11} color="var(--danger)" />
                <span style={{ color: 'var(--danger)', fontSize: '.72rem', fontWeight: 600 }}>Fuera de línea</span>
                <span className="badge badge-danger" style={{ fontSize: '.6rem' }}>No disponible para consulta</span>
              </div>
            )}

            <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>{items.length} sucursal{items.length !== 1 ? 'es' : ''}</span>
          </div>

          {/* ── Tarjetas de tiendas ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {items.map(t => {
              const isDown = t.nodo_activo === false
              return (
                <div key={t.key} className="card" style={{
                  padding: '16px 18px',
                  opacity: isDown ? 0.55 : 1,
                  borderColor: isDown ? 'var(--danger)' : undefined,
                  background: isDown ? 'var(--danger-bg)' : undefined,
                  position: 'relative',
                  transition: 'opacity .2s',
                }}>
                  {/* Badge "No disponible" cuando el nodo está caído */}
                  {isDown && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                    }}>
                      <span className="badge badge-danger" style={{ fontSize: '.65rem' }}>
                        <WifiOff size={9} />
                        No disponible
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: isDown ? 'var(--danger-bg)' : 'var(--accent-bg)',
                      border: `1px solid ${isDown ? 'var(--danger)' : 'var(--accent-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Store size={16} color={isDown ? 'var(--danger)' : 'var(--accent)'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1, paddingRight: isDown ? 70 : 0 }}>
                      <p style={{ color: isDown ? 'var(--text-muted)' : 'var(--text-h)', fontWeight: 700, fontSize: '.88rem' }}>{t.nombre}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: '.7rem', marginTop: 2 }}>
                        <MapPin size={9} />
                        {t.ciudad}
                      </div>
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.direccion}
                  </p>

                  {isDown ? (
                    <div style={{
                      padding: '10px', borderRadius: 6,
                      background: 'rgba(0,0,0,.15)', border: '1px dashed var(--danger)',
                      textAlign: 'center',
                    }}>
                      <WifiOff size={14} color="var(--danger)" style={{ margin: '0 auto 5px', display: 'block' }} />
                      <p style={{ color: 'var(--danger)', fontSize: '.75rem', fontWeight: 600 }}>Nodo {t.nodo} sin conexión</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', marginTop: 2 }}>
                        Datos no disponibles · Puerto {NODE_PORTS[t.nodo]}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[
                        { icon: ShoppingCart, val: t.total_ventas.toLocaleString(), label: 'Ventas' },
                        { icon: Package,      val: t.total_productos,               label: 'Productos' },
                        { icon: DollarSign,   val: fmt(t.ingresos_totales).replace('MX$','$'), label: 'Ingresos' },
                      ].map(({ icon: Icon, val, label }) => (
                        <div key={label} style={{
                          textAlign: 'center', padding: '8px 4px', borderRadius: 6,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                        }}>
                          <Icon size={11} color="var(--accent)" style={{ margin: '0 auto 4px', display: 'block' }} />
                          <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.8rem', lineHeight: 1 }}>{val}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', marginTop: 2 }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
