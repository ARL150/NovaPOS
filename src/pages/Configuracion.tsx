import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme, THEMES } from '../context/ThemeContext'
import api from '../lib/api'
import {
  Palette, Users, UserPlus, Trash2, Shield, Server, Layers,
  Check, AlertCircle, X, Eye, EyeOff
} from 'lucide-react'

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

const ROLE_ICON: Record<string, any> = { admin: Shield, supervisor: Shield, gerente: Server, cajero: Layers }
const ROLE_LABEL: Record<string,string> = { admin:'Administrador', supervisor:'Supervisor Regional', gerente:'Gerente', cajero:'Cajero' }
const ROLE_BADGE: Record<string,string> = {
  admin: 'badge-accent', supervisor: 'badge-warning', gerente: 'badge-warning', cajero: 'badge-muted'
}

type Tab = 'apariencia' | 'usuarios'

export default function Configuracion() {
  const { user, isAdmin, isSuperAdmin } = useAuth()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('apariencia')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', nombre: '', role: 'cajero', tienda: user?.tienda || TIENDAS[0] })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const { data } = await api.get('/usuarios/')
      setUsuarios(data)
    } catch { }
    setLoadingUsers(false)
  }

  useEffect(() => { if (tab === 'usuarios') loadUsers() }, [tab])

  // Roles que puede crear según su propio rol
  const rolesPermitidos =
    isSuperAdmin          ? ['admin', 'supervisor', 'gerente', 'cajero'] :
    user?.role === 'supervisor' ? ['gerente', 'cajero'] :
    ['cajero']

  const crearUsuario = async () => {
    if (!form.username || !form.password || !form.nombre) {
      setMsg({ type: 'err', text: 'Completa todos los campos' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      await api.post('/usuarios/', {
        ...form,
        tienda: form.role === 'admin' ? null : form.tienda,
      })
      setMsg({ type: 'ok', text: 'Usuario creado correctamente' })
      setShowForm(false)
      setForm({ username: '', password: '', nombre: '', role: 'cajero', tienda: user?.tienda || TIENDAS[0] })
      loadUsers()
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Error al crear usuario' })
    }
    setSaving(false)
  }

  const eliminarUsuario = async (username: string) => {
    if (!confirm(`Eliminar usuario "${username}"?`)) return
    try {
      await api.delete(`/usuarios/${username}`)
      setUsuarios(u => u.filter(x => x.username !== username))
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.detail || 'Error al eliminar' })
    }
  }

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'apariencia', label: 'Apariencia', icon: Palette },
    { id: 'usuarios',   label: 'Usuarios',   icon: Users },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Configuración</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: 2 }}>
          Ajustes del sistema y gestión de usuarios
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setMsg(null) }}
            className="btn btn-ghost"
            style={{
              borderRadius: '6px 6px 0 0',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
              gap: 6,
              padding: '8px 14px',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Apariencia ── */}
      {tab === 'apariencia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.95rem', marginBottom: 4 }}>
              Tema de la interfaz
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginBottom: 20 }}>
              El tema seleccionado se guarda en tu navegador
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                    background: theme.id === t.id ? 'var(--accent-bg)' : 'var(--surface2)',
                    border: `1px solid ${theme.id === t.id ? 'var(--accent-border)' : 'var(--border)'}`,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: t.accent,
                    boxShadow: theme.id === t.id ? `0 0 10px ${t.accent}66` : 'none',
                  }} />
                  <div>
                    <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.82rem' }}>{t.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{t.description}</p>
                  </div>
                  {theme.id === t.id && (
                    <Check size={14} color="var(--accent)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '20px 24px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.95rem', marginBottom: 4 }}>
              Acerca de NovaPOS
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginBottom: 16 }}>
              Sistema de Punto de Venta Distribuido
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Versión', '1.0.0'],
                ['Base de datos', 'MongoDB 7 · 3 nodos'],
                ['Sucursales', '10 tiendas distribuidas'],
                ['Universidad', 'UAA · Base de Datos Distribuidas 2026'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{k}</span>
                  <span style={{ color: 'var(--text-h)', fontSize: '.82rem', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Usuarios ── */}
      {tab === 'usuarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {msg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              background: msg.type === 'ok' ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${msg.type === 'ok' ? 'var(--success)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius-sm)', fontSize: '.82rem',
              color: msg.type === 'ok' ? 'var(--success)' : 'var(--danger)',
            }}>
              {msg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
              {msg.text}
              <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                <X size={13} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
              {isAdmin ? 'Todos los usuarios del sistema' : 'Cajeros de tu sucursal'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {isSuperAdmin && (
                <button className="btn btn-secondary" onClick={() => setShowPasswords(s => !s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPasswords ? 'Ocultar contraseñas' : 'Ver contraseñas'}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setMsg(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={14} />
                Nuevo usuario
              </button>
            </div>
          </div>

          {/* Formulario de nuevo usuario */}
          {showForm && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem', marginBottom: 16 }}>
                Crear usuario
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 4 }}>Nombre completo</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan García" />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 4 }}>Nombre de usuario</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="juan.garcia" />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 4 }}>Contraseña</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 4 }}>Rol</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {rolesPermitidos.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                {form.role !== 'admin' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 4 }}>Sucursal</label>
                    <select
                      value={form.tienda}
                      onChange={e => setForm(f => ({ ...f, tienda: e.target.value }))}
                      disabled={user?.role === 'gerente'}
                    >
                      {(isAdmin ? TIENDAS : user?.role === 'gerente' ? [user?.tienda || ''] : TIENDAS).map(k => (
                        <option key={k} value={k}>{TIENDA_NOMBRES[k] || k}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={crearUsuario} disabled={saving}>
                  {saving ? 'Guardando...' : 'Crear usuario'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de usuarios */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {loadingUsers ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>
                Cargando usuarios...
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Sucursal</th>
                    {isSuperAdmin && showPasswords && <th>Contraseña</th>}
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const Icon = ROLE_ICON[u.role] || Layers
                    return (
                      <tr key={u.username + u.origen}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--accent)', fontWeight: 700, fontSize: '.75rem',
                            }}>
                              {u.nombre?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.82rem' }}>{u.nombre}</p>
                              <p style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[u.role] || 'badge-muted'}`}>
                            <Icon size={10} />
                            {ROLE_LABEL[u.role] || u.role}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
                          {u.tienda ? TIENDA_NOMBRES[u.tienda] || u.tienda : 'Global'}
                        </td>
                        {isSuperAdmin && showPasswords && (
                          <td>
                            <code style={{
                              fontSize: '.75rem', color: 'var(--accent)',
                              background: 'var(--surface2)', padding: '2px 7px',
                              borderRadius: 4, fontFamily: 'monospace',
                            }}>
                              {u.password_plain || '—'}
                            </code>
                          </td>
                        )}
                        <td style={{ textAlign: 'right' }}>
                          {/* Admin/supervisor: puede eliminar a todos menos a sí mismo
                              Gerente: solo puede eliminar cajeros de su propia tienda */}
                          {u.username !== user?.username && (() => {
                            const esRolPrivilegiado = u.role === 'admin' || u.role === 'supervisor'
                            const puedeEliminar =
                              isSuperAdmin
                                ? true  // admin puro puede eliminar a cualquiera
                                : user?.role === 'supervisor'
                                  ? !esRolPrivilegiado  // supervisor: no puede borrar admin/supervisor
                                  : (user?.role === 'gerente'
                                      && u.role === 'cajero'
                                      && u.tienda === user?.tienda)
                            return puedeEliminar ? (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '5px 8px', color: 'var(--danger)' }}
                                onClick={() => eliminarUsuario(u.username)}
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span style={{ color: 'var(--border)', fontSize: '.68rem', padding: '5px 8px' }}>—</span>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
