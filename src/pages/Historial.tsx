import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { ChevronLeft, ChevronRight, CreditCard, Banknote, Smartphone, Ticket, Download } from 'lucide-react'

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

const METODO_INFO: Record<string, { label: string; badge: string; icon: any }> = {
  efectivo:        { label: 'Efectivo',         badge: 'badge-success', icon: Banknote },
  tarjeta_debito:  { label: 'Tarjeta débito',   badge: 'badge-accent',  icon: CreditCard },
  tarjeta_credito: { label: 'Tarjeta crédito',  badge: 'badge-accent',  icon: CreditCard },
  transferencia:   { label: 'Transferencia',    badge: 'badge-warning', icon: Smartphone },
  vales:           { label: 'Vales',            badge: 'badge-muted',   icon: Ticket },
}

export default function Historial() {
  const { user, isAdmin } = useAuth()
  const [tiendaKey, setTiendaKey] = useState(user?.tienda || TIENDAS[0])
  const [ventas, setVentas] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const limit = 15

  useEffect(() => { setPage(1) }, [tiendaKey])
  useEffect(() => {
    setLoading(true)
    api.get(`/ventas/${tiendaKey}?page=${page}&limit=${limit}`)
      .then(r => { setVentas(r.data.ventas); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [tiendaKey, page])

  const totalPages = Math.ceil(total / limit)

  const exportCSV = () => {
    const headers = ['Fecha','Cliente','Cajero','Método de pago','Total MXN']
    const rows = ventas.map(v => [
      new Date(v.fecha).toLocaleString('es-MX'),
      v.cliente || 'General',
      v.cajero_id || '—',
      METODO_INFO[v.metodo_pago]?.label || v.metodo_pago,
      (v.total || 0).toFixed(2),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `historial_${tiendaKey}_p${page}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Historial de ventas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: 2 }}>
            {total.toLocaleString()} ventas · {TIENDA_NOMBRES[tiendaKey]}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <select value={tiendaKey} onChange={e => setTiendaKey(e.target.value)} style={{ width: 'auto' }}>
              {TIENDAS.map(k => <option key={k} value={k}>{TIENDA_NOMBRES[k]}</option>)}
            </select>
          )}
          <button
            className="btn btn-secondary"
            onClick={exportCSV}
            disabled={ventas.length === 0}
            style={{ gap: 6, whiteSpace: 'nowrap' }}
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha y hora</th>
              <th>Cliente</th>
              <th>Cajero</th>
              <th>Método de pago</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando...</td></tr>
            ) : !ventas.length ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '.82rem' }}>Sin registros</td></tr>
            ) : ventas.map(v => {
              const m = METODO_INFO[v.metodo_pago] || { label: v.metodo_pago, badge: 'badge-muted', icon: Banknote }
              const MIcon = m.icon
              return (
                <tr key={v._id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
                    {new Date(v.fecha).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{v.cliente_nombre}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>{v.cajero}</td>
                  <td>
                    <span className={`badge ${m.badge}`}>
                      <MIcon size={10} />
                      {m.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>{fmt(v.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
            {(page-1)*limit+1}–{Math.min(page*limit, total)} de {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ padding: '6px 10px' }}
              onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
              <ChevronLeft size={14} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 10px' }}
              onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
