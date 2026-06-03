import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import {
  LayoutDashboard, ShoppingCart, BarChart2, Package, PackagePlus,
  Store, LogOut, Settings, History, Database, Wifi, WifiOff, Loader, DatabaseZap, HardDrive,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',         roles: ['admin','supervisor','gerente'] },
  { to: '/tiendas',    icon: Store,           label: 'Tiendas',           roles: ['admin','supervisor'] },
  { to: '/ventas',     icon: ShoppingCart,    label: 'Nueva Venta',       roles: ['admin','supervisor','gerente','cajero'] },
  { to: '/historial',  icon: History,         label: 'Historial',         roles: ['admin','supervisor','gerente','cajero'] },
  { to: '/productos',  icon: Package,         label: 'Inventario',        roles: ['admin','supervisor','gerente','cajero'] },
  { to: '/mercancia',  icon: PackagePlus,     label: 'Agregar mercancía', roles: ['admin','supervisor','gerente'] },
  { to: '/reportes',   icon: BarChart2,       label: 'Reportes',          roles: ['admin','supervisor','gerente'] },
  { to: '/explorer',   icon: DatabaseZap,     label: 'Explorador BD',     roles: ['admin'] },
  { to: '/nodo4',      icon: HardDrive,       label: 'Réplica Global',    roles: ['admin'] },
  { to: '/config',     icon: Settings,        label: 'Configuración',     roles: ['admin','supervisor','gerente'] },
]

const ROLE_LABEL: Record<string,string> = {
  admin: 'Administrador', supervisor: 'Supervisor Regional', gerente: 'Gerente', cajero: 'Cajero'
}

type NodeStatus = 'OK' | 'ERROR' | 'checking'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = NAV.filter(n => n.roles.includes(user?.role ?? ''))

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
    }).catch(() => setNodos({ nodo1: 'ERROR', nodo2: 'ERROR', nodo3: 'ERROR' }))
  }

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Database size={16} color="var(--accent)" />
          </div>
          <div>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem', lineHeight: 1.2 }}>NovaPOS</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>Sistema Distribuido</p>
          </div>
        </div>
      </div>

      {/* ── Usuario ── */}
      <div style={{ padding: '10px 10px 6px' }}>
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '9px 11px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', fontWeight: 700, fontSize: '.8rem', flexShrink: 0,
            }}>
              {user?.nombre?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'var(--text-h)', fontSize: '.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre}
              </p>
              <p style={{ color: 'var(--accent)', fontSize: '.68rem', fontWeight: 500 }}>
                {ROLE_LABEL[user?.role ?? ''] || user?.role}
              </p>
            </div>
          </div>
          {user?.tienda && (
            <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.tienda.replace('tienda_','').replace(/_/g,' ').toUpperCase()}
            </p>
          )}
        </div>
      </div>

      {/* ── Nodos ── */}
      <div style={{ padding: '2px 10px 8px', display: 'flex', gap: 5 }}>
        {([1,2,3,4] as const).map(n => {
          const key = `nodo${n}` as keyof typeof nodos
          const status = nodos[key]
          const isOk = status === 'OK'
          const isChecking = status === 'checking'
          return (
            <div key={n} title={`Nodo ${n}: ${status}`} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '4px 0', borderRadius: 'var(--radius-sm)', cursor: 'default',
              background: isChecking ? 'var(--surface2)' : isOk ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${isChecking ? 'var(--border)' : isOk ? 'transparent' : 'var(--danger)'}`,
              fontSize: '.65rem',
              color: isChecking ? 'var(--text-muted)' : isOk ? 'var(--success)' : 'var(--danger)',
              transition: 'all .3s',
            }}>
              {isChecking
                ? <Loader size={7} className="spin" />
                : isOk
                  ? <Wifi size={8} />
                  : <WifiOff size={8} />
              }
              N{n}
            </div>
          )
        })}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '0 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 4px 4px' }}>
          Navegación
        </p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
        <button
          className="nav-link btn"
          style={{ width: '100%', justifyContent: 'flex-start', border: 'none', padding: '8px 10px' }}
          onClick={() => { logout(); navigate('/login') }}
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
