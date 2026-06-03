import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { AlertTriangle } from 'lucide-react'

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
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const PIE_COLORS = ['#58a6ff','#3fb950','#d29922','#f85149','#bf00ff','#00c8f0']

export default function Reportes() {
  const { user, isAdmin } = useAuth()
  const { theme } = useTheme()
  const [tiendaKey, setTiendaKey] = useState(user?.tienda || TIENDAS[0])
  const [ventasDia, setVentasDia] = useState<any[]>([])
  const [topProds, setTopProds] = useState<any[]>([])
  const [metodos, setMetodos] = useState<any[]>([])
  const [invBajo, setInvBajo] = useState<any[]>([])
  const [resumen, setResumen] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const TT = {
    contentStyle: { background: theme.surface, border: `1px solid rgba(255,255,255,.1)`, borderRadius: 8, fontSize: 11 },
    labelStyle: { color: theme.textMuted },
    cursor: { fill: 'rgba(255,255,255,.03)' },
  }

  useEffect(() => {
    setLoading(true)
    const calls: Promise<any>[] = [
      api.get(`/reportes/ventas-por-dia/${tiendaKey}`),
      api.get(`/reportes/productos-mas-vendidos/${tiendaKey}?limit=8`),
      api.get(`/reportes/metodos-pago/${tiendaKey}`),
      api.get(`/reportes/inventario-bajo/${tiendaKey}?umbral=15`),
    ]
    if (isAdmin) calls.push(api.get('/reportes/resumen-global'))

    Promise.all(calls).then(([dias, prods, met, inv, glob]) => {
      setVentasDia(dias.data.slice(-20))
      setTopProds(prods.data)
      setMetodos(met.data.map((m: any) => ({ name: m._id.replace('_',' '), value: m.total, monto: m.monto })))
      setInvBajo(inv.data)
      if (glob) setResumen(glob.data)
    }).finally(() => setLoading(false))
  }, [tiendaKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Reportes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: 2 }}>Análisis de ventas e inventario</p>
        </div>
        <select value={tiendaKey} onChange={e => setTiendaKey(e.target.value)} style={{ width: 'auto' }}>
          {(isAdmin ? TIENDAS : [user?.tienda||'']).map(k => (
            <option key={k} value={k}>{TIENDA_NOMBRES[k]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '.82rem' }}>
          <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display:'block', margin:'0 auto 10px' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
          </svg>
          Consultando nodos MongoDB...
        </div>
      ) : (
        <>
          {/* Ingresos diarios */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 2 }}>Ingresos diarios</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.75rem', marginBottom: 14 }}>Últimos 20 días · {TIENDA_NOMBRES[tiendaKey]}</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={ventasDia}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.accent} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={theme.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="fecha" tick={{ fill:theme.textMuted, fontSize:9 }} tickFormatter={v=>v.slice(5)}/>
                <YAxis tick={{ fill:theme.textMuted, fontSize:9 }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip {...TT} formatter={(v:any)=>[fmt(v),'Ingresos']}/>
                <Area type="monotone" dataKey="ingresos" stroke={theme.accent} strokeWidth={2} fill="url(#ag)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Top productos */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 14 }}>Top productos vendidos</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProds} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                  <XAxis type="number" tick={{ fill:theme.textMuted, fontSize:9 }}/>
                  <YAxis dataKey="producto" type="category" tick={{ fill:theme.text, fontSize:9 }} width={115}
                    tickFormatter={v=>v.length>16?v.slice(0,16)+'…':v}/>
                  <Tooltip {...TT} formatter={(v:any)=>[v,'Unidades']}/>
                  <Bar dataKey="cantidad" fill={theme.accent} radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Métodos de pago */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', marginBottom: 14 }}>Métodos de pago</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={metodos} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {metodos.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip {...TT} formatter={(v:any)=>[v,'Transacciones']}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:4 }}>
                {metodos.map((m,i)=>(
                  <div key={m.name} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.7rem', color:'var(--text-muted)' }}>
                    <div style={{ width:8, height:8, borderRadius:2, flexShrink:0, background:PIE_COLORS[i%PIE_COLORS.length] }}/>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                    <span style={{ marginLeft:'auto', color:'var(--text-h)', fontWeight:700 }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inventario bajo */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <AlertTriangle size={14} color="var(--warning)" />
                <p style={{ color:'var(--text-h)', fontWeight:700, fontSize:'.88rem' }}>Inventario bajo</p>
              </div>
              <span className="badge badge-warning">≤ 15 unidades</span>
            </div>
            {invBajo.length===0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'var(--success)', fontSize:'.82rem' }}>
                Sin productos con stock critico
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th style={{ textAlign:'right' }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {invBajo.slice(0,15).map((p,i)=>(
                    <tr key={i}>
                      <td style={{ color:'var(--text-h)', fontWeight:500 }}>{p.nombre}</td>
                      <td><span className="badge badge-muted">{p.categoria}</span></td>
                      <td style={{ textAlign:'right' }}>
                        <span className={`badge ${p.stock<=5?'badge-danger':'badge-warning'}`}>{p.stock}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Comparativo global */}
          {isAdmin && resumen.length > 0 && (
            <div className="card" style={{ padding:'16px 20px' }}>
              <p style={{ color:'var(--text-h)', fontWeight:700, fontSize:'.88rem', marginBottom:14 }}>Comparativo de ingresos — todas las sucursales</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={resumen}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="tienda_nombre" tick={{ fill:theme.textMuted, fontSize:9 }} tickFormatter={v=>v.replace('OXXO ','')}/>
                  <YAxis tick={{ fill:theme.textMuted, fontSize:9 }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip {...TT} formatter={(v:any)=>[fmt(v),'Ingresos']}/>
                  <Bar dataKey="total_ingresos" fill={theme.accent} radius={[4,4,0,0]} opacity={0.85}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

