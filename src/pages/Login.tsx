import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, THEMES } from '../context/ThemeContext'
import type { ThemeId } from '../context/ThemeContext'
import { Eye, EyeOff, AlertCircle, Database, Shield, Server, Layers, Palette, Check, ChevronUp, Wifi, WifiOff, RefreshCw as RefreshCwIcon, ServerCrash, ShieldCheck } from 'lucide-react'
import api from '../lib/api'

const DEMO_GROUPS: {
  label: string
  color: string
  users: { label: string; sub: string; u: string; p: string; icon: any }[]
}[] = [
  {
    label: 'Administrador',
    color: 'var(--accent)',
    users: [
      { label: 'Admin Global',       sub: 'Acceso total · contraseñas', u: 'admin',      p: 'admin2026',  icon: Shield },
      { label: 'Supervisor Regional', sub: 'Sin ver contraseñas',        u: 'supervisor', p: 'super2026',  icon: Server },
    ],
  },
  {
    label: 'Gerentes — por nodo',
    color: 'var(--success)',
    users: [
      { label: 'Centro',       sub: 'Nodo 1 · :27017', u: 'gerente_tienda_centro',      p: 'gerente123', icon: Server },
      { label: 'Sur',          sub: 'Nodo 2 · :27018', u: 'gerente_tienda_sur',          p: 'gerente123', icon: Server },
      { label: 'Universidad',  sub: 'Nodo 3 · :27019', u: 'gerente_tienda_universidad',  p: 'gerente123', icon: Server },
    ],
  },
  {
    label: 'Cajeros — por nodo',
    color: 'var(--warning)',
    users: [
      { label: 'Norte',        sub: 'Nodo 1 · :27017', u: 'cajero1_tienda_norte',        p: 'cajero123', icon: Layers },
      { label: 'Este',         sub: 'Nodo 2 · :27018', u: 'cajero1_tienda_este',          p: 'cajero123', icon: Layers },
      { label: 'Tecnológico',  sub: 'Nodo 3 · :27019', u: 'cajero1_tienda_tecnologico',  p: 'cajero123', icon: Layers },
    ],
  },
]

export default function Login() {
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'auth' | 'node' | 'network' | ''>('')
  const [loading, setLoading] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const themeRef = useRef<HTMLDivElement>(null)
  const [nodos, setNodos] = useState<Record<string, 'OK' | 'ERROR' | 'checking'>>({
    nodo1: 'checking', nodo2: 'checking', nodo3: 'checking', nodo4: 'checking',
  })

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    api.get('/health').then(r => {
      const n = r.data?.nodos || {}
      setNodos({
        nodo1: String(n.nodo1).startsWith('OK') ? 'OK' : 'ERROR',
        nodo2: String(n.nodo2).startsWith('OK') ? 'OK' : 'ERROR',
        nodo3: String(n.nodo3).startsWith('OK') ? 'OK' : 'ERROR',
        nodo4: String(n.nodo4).startsWith('OK') ? 'OK' : 'ERROR',
      })
    }).catch(() => {
      setNodos({ nodo1: 'ERROR', nodo2: 'ERROR', nodo3: 'ERROR', nodo4: 'ERROR' })
    })
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorType('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/dashboard')
    } catch (err: any) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 503) {
        setErrorType('node')
        setError(detail || 'Sistema no disponible. Un nodo MongoDB está fuera de línea.')
      } else if (status === 401) {
        setErrorType('auth')
        setError('Usuario o contraseña incorrectos. Verifica tus credenciales e intenta de nuevo.')
      } else if (status === 422) {
        setErrorType('auth')
        setError('Ingresa usuario y contraseña.')
      } else if (!err.response) {
        setErrorType('network')
        setError('No se pudo conectar al servidor. Verifica que el backend esté activo.')
      } else {
        setErrorType('auth')
        setError(detail || 'Error al iniciar sesión.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>

      {/* ── Panel izquierdo ── */}
      <div style={{
        width: '42%', background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '40px 48px',
      }} className="hidden-mobile">

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Database size={18} color="var(--accent)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>NovaPOS</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.7rem' }}>Sistema Distribuido</p>
            </div>
          </div>

          <h1 style={{ color: 'var(--text-h)', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.2, marginBottom: 12 }}>
            Plataforma de gestión<br />
            <span style={{ color: 'var(--accent)' }}>distribuida de ventas</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', lineHeight: 1.7 }}>
            Sistema de punto de venta con base de datos distribuida en 3 nodos MongoDB
            y 10 sucursales con particionamiento horizontal.
          </p>

          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: Server,   title: '3 Nodos MongoDB',       sub: 'Particionamiento horizontal por sucursal' },
              { icon: Shield,   title: 'Control de acceso',      sub: 'JWT por rol: Admin, Gerente, Cajero' },
              { icon: Layers,   title: '10 sucursales',          sub: 'Distribuidas en Aguascalientes' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6, flexShrink: 0, marginTop: 2,
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} color="var(--accent)" />
                </div>
                <div>
                  <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.85rem' }}>{title}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estado de nodos en tiempo real */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Estado de la infraestructura
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {([1, 2, 3, 4] as const).map(n => {
              const key = `nodo${n}` as keyof typeof nodos
              const status = nodos[key]
              const isOk = status === 'OK'
              const isChecking = status === 'checking'
              const isRecovery = n === 4
              return (
                <div key={n} style={{
                  padding: '10px 6px', borderRadius: 8, border: '1px solid',
                  background: isChecking
                    ? 'var(--surface2)'
                    : isRecovery
                      ? isOk ? 'var(--accent-bg)' : 'rgba(210,153,34,.08)'
                      : isOk ? 'var(--success-bg)' : 'var(--danger-bg)',
                  borderColor: isChecking
                    ? 'var(--border)'
                    : isRecovery
                      ? isOk ? 'var(--accent-border)' : 'rgba(210,153,34,.4)'
                      : isOk ? 'transparent' : 'var(--danger)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                }}>
                  {isChecking
                    ? <RefreshCwIcon size={13} color="var(--text-muted)" />
                    : isOk
                      ? isRecovery
                        ? <ShieldCheck size={13} color="var(--accent)" />
                        : <Wifi size={13} color="var(--success)" />
                      : <WifiOff size={13} color={isRecovery ? 'var(--warning)' : 'var(--danger)'} />
                  }
                  <p style={{
                    fontSize: '.63rem', fontWeight: 700,
                    color: isChecking ? 'var(--text-muted)' : isRecovery ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    Nodo {n}
                  </p>
                  {isRecovery && (
                    <span style={{ fontSize: '.55rem', color: 'var(--accent)', fontWeight: 600, letterSpacing: '.03em' }}>
                      Recuperación
                    </span>
                  )}
                  <span style={{
                    fontSize: '.58rem', fontWeight: 800, letterSpacing: '.04em',
                    color: isChecking
                      ? 'var(--text-muted)'
                      : isRecovery
                        ? isOk ? 'var(--accent)' : 'var(--warning)'
                        : isOk ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {isChecking ? '...' : isOk ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selector de tema — popup */}
        <div ref={themeRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setThemeOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
              cursor: 'pointer', width: '100%', transition: 'border-color .15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          >
            <div style={{ width: 18, height: 18, borderRadius: 4, background: theme.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.82rem', lineHeight: 1 }}>{theme.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.7rem', marginTop: 1 }}>{theme.description}</p>
            </div>
            <Palette size={13} color="var(--text-muted)" />
            <ChevronUp size={13} color="var(--text-muted)" style={{ transform: themeOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .2s' }} />
          </button>

          {themeOpen && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)', zIndex: 100,
            }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id as ThemeId); setThemeOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    width: '100%', background: theme.id === t.id ? 'var(--accent-bg)' : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background .12s',
                  }}
                  onMouseEnter={e => { if (theme.id !== t.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = theme.id === t.id ? 'var(--accent-bg)' : 'transparent' }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: t.accent, flexShrink: 0,
                    boxShadow: theme.id === t.id ? `0 0 8px ${t.accent}80` : 'none' }} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.8rem', lineHeight: 1 }}>{t.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', marginTop: 1 }}>{t.description}</p>
                  </div>
                  {theme.id === t.id && <Check size={12} color="var(--accent)" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Encabezado del formulario */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Shield size={20} color="var(--accent)" />
              </div>
              <div>
                <h2 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1 }}>
                  Iniciar sesión
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', marginTop: 2 }}>
                  NovaPOS · Sistema Distribuido
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px',
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              borderRadius: 8,
            }}>
              <Server size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
              <p style={{ color: 'var(--accent)', fontSize: '.78rem', fontWeight: 500 }}>
                Accede con tus credenciales de sucursal
              </p>
            </div>
          </div>

          <form onSubmit={submit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.78rem', fontWeight: 600, marginBottom: 5 }}>
                Usuario
              </label>
              <input
                type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.78rem', fontWeight: 600, marginBottom: 5 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  autoComplete="new-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button" onClick={() => setShow(s => !s)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && errorType === 'node' && (
              <div style={{
                padding: '12px 14px',
                background: 'var(--warning-bg)', border: '1px solid var(--warning)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ServerCrash size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
                  <p style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '.85rem' }}>
                    Sistema no disponible
                  </p>
                </div>
                <p style={{ color: 'var(--warning)', fontSize: '.78rem', opacity: .9, lineHeight: 1.5 }}>
                  {error}
                </p>
              </div>
            )}

            {error && errorType !== 'node' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.82rem',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '10px', marginTop: 4 }}>
              {loading ? (
                <><svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg> Autenticando...</>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          {/* Aviso legal */}
          <p style={{
            marginTop: 28, color: 'var(--text-muted)', fontSize: '.65rem',
            lineHeight: 1.6, textAlign: 'center',
          }}>
            El uso de este sistema está regulado por la{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)
            </span>
            . El acceso no autorizado constituye un delito conforme al{' '}
            <span style={{ fontWeight: 600 }}>Código Penal Federal, Art. 211</span>.
            El uso indebido será sancionado.
          </p>

          {/* Accesos demo */}
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>
                Accesos demo
              </p>
              <span style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>
                clic para autocompletar
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEMO_GROUPS.map(group => (
                <div key={group.label}>
                  <p style={{
                    color: 'var(--text-muted)', fontSize: '.63rem', fontWeight: 700,
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: group.color, display: 'inline-block', flexShrink: 0 }} />
                    {group.label}
                  </p>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${group.users.length}, 1fr)`,
                    gap: 6,
                  }}>
                    {group.users.map(({ label, sub, u, p, icon: Icon }) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => { setUsername(u); setPassword(p) }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 6, padding: '10px 8px', cursor: 'pointer',
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 8, transition: 'all .15s', textAlign: 'center',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLElement
                          el.style.borderColor = group.color
                          el.style.background = 'var(--surface)'
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLElement
                          el.style.borderColor = 'var(--border)'
                          el.style.background = 'var(--surface2)'
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${group.color}18`,
                          border: `1px solid ${group.color}40`,
                        }}>
                          <Icon size={13} color={group.color} />
                        </div>
                        <div>
                          <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.75rem', lineHeight: 1.1 }}>{label}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '.62rem', marginTop: 2, lineHeight: 1.3 }}>{sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
