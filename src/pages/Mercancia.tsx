import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import {
  PackagePlus, Save, RefreshCw, CheckCircle, XCircle,
  Tag, Store, Layers2,
  Coffee, GlassWater, Milk, Wheat, Sparkles, Cookie,
  Beef, Leaf, Pill, ShoppingBag, Cigarette, Sandwich,
  ChevronDown, ChevronUp,
} from 'lucide-react'

/* ── Íconos por categoría ─────────────────────────────── */
const CAT_ICON: Record<string, LucideIcon> = {
  bebidas: GlassWater, 'bebidas calientes': Coffee, café: Coffee,
  lácteos: Milk, lacteos: Milk,
  panadería: Wheat, panaderia: Wheat,
  snacks: Cookie, botanas: Cookie,
  carnes: Beef,
  frutas: Leaf, verduras: Leaf,
  limpieza: Sparkles, aseo: Sparkles,
  farmacia: Pill, salud: Pill,
  tabaco: Cigarette, cigarros: Cigarette,
  alimentos: Sandwich, comida: Sandwich,
  otros: ShoppingBag, general: ShoppingBag,
}
const getCatIcon = (cat: string): LucideIcon => {
  const key = cat.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [k, v] of Object.entries(CAT_ICON)) {
    const kn = k.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (key.includes(kn) || kn.includes(key)) return v
  }
  return Tag
}

/* ── Constantes ──────────────────────────────────────── */
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
const TIENDA_NODO: Record<string,number> = {
  tienda_centro:1, tienda_norte:1, tienda_sur:2, tienda_este:2, tienda_oeste:2,
  tienda_universidad:3, tienda_insurgentes:3, tienda_tecnologico:3, tienda_alameda:3, tienda_jardines:3,
}

type ResultadoTienda = { key: string; ok: boolean; msg: string }

const FORM_VACIO = { nombre: '', categoria: '', categoriaCustom: '', precio: '', stock: '', proveedor: '', codigo_barras: '' }

export default function Mercancia() {
  const { user } = useAuth()
  const isGerente = user?.role === 'gerente'

  /* destino: '__todas__' | key de tienda */
  const [destino, setDestino] = useState<string>(
    isGerente ? (user?.tienda || TIENDAS[0]) : '__todas__'
  )

  /* selector individual de tiendas (modo selección múltiple visual) */
  const [tiendaSel, setTiendaSel] = useState<Set<string>>(new Set(TIENDAS))

  const [form, setForm] = useState({ ...FORM_VACIO })
  const [categorias, setCategorias] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [resultados, setResultados] = useState<ResultadoTienda[]>([])
  const [expandResult, setExpandResult] = useState(false)

  /* Cargar categorías de la primera tienda disponible */
  useEffect(() => {
    const key = isGerente ? (user?.tienda || TIENDAS[0]) : TIENDAS[0]
    api.get(`/productos/${key}/categorias/lista`).then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  const tiendaDestinos = destino === '__todas__'
    ? TIENDAS.filter(k => tiendaSel.has(k))
    : [destino]

  const toggleTienda = (k: string) =>
    setTiendaSel(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })

  const guardar = async () => {
    const catFinal = form.categoria === '__nueva__' ? form.categoriaCustom.trim() : form.categoria
    if (!form.nombre.trim() || !catFinal || !form.precio || !form.stock) return
    if (tiendaDestinos.length === 0) return

    setSaving(true)
    setResultados([])
    setExpandResult(true)

    const payload = {
      nombre: form.nombre.trim(),
      categoria: catFinal,
      precio: parseFloat(form.precio),
      stock: parseInt(form.stock),
      proveedor: form.proveedor.trim() || null,
      codigo_barras: form.codigo_barras.trim() || null,
    }

    const resultados = await Promise.allSettled(
      tiendaDestinos.map(k => api.post(`/productos/${k}`, payload).then(() => k))
    )

    const resumen: ResultadoTienda[] = resultados.map((r, i) => {
      const key = tiendaDestinos[i]
      if (r.status === 'fulfilled') return { key, ok: true, msg: 'Producto agregado correctamente' }
      const detail = (r.reason as any)?.response?.data?.detail || 'Error al guardar'
      return { key, ok: false, msg: detail }
    })

    setResultados(resumen)
    const allOk = resumen.every(r => r.ok)
    if (allOk) {
      setForm({ ...FORM_VACIO })
      // Recargar categorías
      const key = isGerente ? (user?.tienda || TIENDAS[0]) : TIENDAS[0]
      api.get(`/productos/${key}/categorias/lista`).then(r => setCategorias(r.data)).catch(() => {})
    }
    setSaving(false)
  }

  const okCount = resultados.filter(r => r.ok).length
  const errCount = resultados.filter(r => !r.ok).length
  const camposOk = form.nombre.trim() && (form.categoria && form.categoria !== '') && form.precio && form.stock && tiendaDestinos.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PackagePlus size={16} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800 }}>Agregar mercancía</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
              {isGerente ? `Solo tu sucursal · ${TIENDA_NOMBRES[user?.tienda || '']}` : 'Agrega productos a una o todas las sucursales'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isGerente ? '1fr' : '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* ── Formulario ── */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.9rem', marginBottom: 16 }}>
            Datos del producto
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Nombre — full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Nombre del producto <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Coca-Cola 600ml" autoComplete="off" />
            </div>

            {/* Categoría */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Categoría <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__nueva__">+ Nueva categoría...</option>
              </select>
              {/* Vista previa del ícono de categoría */}
              {form.categoria && form.categoria !== '__nueva__' && (() => {
                const CatIcon = getCatIcon(form.categoria)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CatIcon size={11} color="var(--accent)" />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{form.categoria}</span>
                  </div>
                )
              })()}
            </div>

            {/* Nueva categoría custom */}
            {form.categoria === '__nueva__' ? (
              <div>
                <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                  Nombre de la nueva categoría <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input value={form.categoriaCustom} onChange={e => setForm(f => ({ ...f, categoriaCustom: e.target.value }))}
                  placeholder="Ej. Electrónica" autoComplete="off" />
              </div>
            ) : <div />}

            {/* Precio */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Precio MXN <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="number" min="0" step="0.01" value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="0.00" />
            </div>

            {/* Stock */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Stock inicial <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input type="number" min="0" value={form.stock}
                onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="0" />
            </div>

            {/* Proveedor */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Proveedor <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                placeholder="Ej. Coca-Cola FEMSA" autoComplete="off" />
            </div>

            {/* Código de barras */}
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.75rem', fontWeight: 600, marginBottom: 5 }}>
                Código de barras <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <input value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
                placeholder="Ej. 7501055300008" autoComplete="off" />
            </div>
          </div>

          {/* Botón guardar */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>
              {tiendaDestinos.length === 1
                ? `→ Se agregará a ${TIENDA_NOMBRES[tiendaDestinos[0]]}`
                : `→ Se agregará a ${tiendaDestinos.length} sucursales`}
            </p>
            <button
              className="btn btn-primary"
              onClick={guardar}
              disabled={saving || !camposOk}
              style={{ gap: 7, minWidth: 160 }}
            >
              {saving
                ? <><RefreshCw size={13} className="spin" /> Guardando...</>
                : <><Save size={13} /> Guardar producto</>
              }
            </button>
          </div>
        </div>

        {/* ── Panel de destino (solo admin/supervisor) ── */}
        {!isGerente && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Modo: todas o individual */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.85rem', marginBottom: 12 }}>Sucursal destino</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

                <button
                  onClick={() => setDestino('__todas__')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
                    borderRadius: 8, border: '1px solid', cursor: 'pointer', textAlign: 'left',
                    background: destino === '__todas__' ? 'var(--accent-bg)' : 'var(--surface2)',
                    borderColor: destino === '__todas__' ? 'var(--accent-border)' : 'var(--border)',
                    transition: 'all .15s',
                  }}
                >
                  <Layers2 size={14} color={destino === '__todas__' ? 'var(--accent)' : 'var(--text-muted)'} />
                  <div>
                    <p style={{ color: destino === '__todas__' ? 'var(--accent)' : 'var(--text-h)', fontWeight: 600, fontSize: '.82rem' }}>
                      Múltiples sucursales
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', marginTop: 1 }}>
                      Selecciona abajo cuáles
                    </p>
                  </div>
                </button>

                {TIENDAS.map(k => (
                  <button
                    key={k}
                    onClick={() => setDestino(k)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px',
                      borderRadius: 8, border: '1px solid', cursor: 'pointer', textAlign: 'left',
                      background: destino === k ? 'var(--accent-bg)' : 'var(--surface2)',
                      borderColor: destino === k ? 'var(--accent-border)' : 'var(--border)',
                      transition: 'all .15s',
                    }}
                  >
                    <Store size={13} color={destino === k ? 'var(--accent)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: destino === k ? 'var(--accent)' : 'var(--text-h)',
                        fontWeight: 600, fontSize: '.78rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {TIENDA_NOMBRES[k]}
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>Nodo {TIENDA_NODO[k]}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector múltiple (cuando destino === '__todas__') */}
            {destino === '__todas__' && (
              <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.82rem' }}>
                    {tiendaSel.size} / {TIENDAS.length} sucursales
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '.7rem' }}
                      onClick={() => setTiendaSel(new Set(TIENDAS))}>Todas</button>
                    <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '.7rem' }}
                      onClick={() => setTiendaSel(new Set())}>Ninguna</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {TIENDAS.map(k => {
                    const on = tiendaSel.has(k)
                    return (
                      <label key={k} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                        borderRadius: 6, cursor: 'pointer',
                        background: on ? 'var(--success-bg)' : 'transparent',
                        transition: 'background .12s',
                      }}>
                        <input type="checkbox" checked={on} onChange={() => toggleTienda(k)}
                          style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                        <span style={{ color: on ? 'var(--text-h)' : 'var(--text-muted)', fontSize: '.78rem', fontWeight: on ? 600 : 400 }}>
                          {TIENDA_NOMBRES[k]}
                        </span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '.65rem' }}>
                          N{TIENDA_NODO[k]}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Resultados ── */}
      {resultados.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', borderColor: errCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
          <button
            onClick={() => setExpandResult(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: expandResult ? '1px solid var(--border)' : 'none',
            }}
          >
            {errCount === 0
              ? <CheckCircle size={14} color="var(--success)" />
              : <XCircle size={14} color="var(--warning)" />
            }
            <p style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '.85rem', flex: 1, textAlign: 'left' }}>
              {errCount === 0
                ? `✅ Producto agregado en ${okCount} sucursal${okCount !== 1 ? 'es' : ''}`
                : `⚠️ ${okCount} exitosos · ${errCount} con error`
              }
            </p>
            {expandResult ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
          </button>

          {expandResult && (
            <div style={{ padding: '8px 8px' }}>
              {resultados.map(r => (
                <div key={r.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                  borderRadius: 6, marginBottom: 3,
                  background: r.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                }}>
                  {r.ok
                    ? <CheckCircle size={12} color="var(--success)" style={{ flexShrink: 0 }} />
                    : <XCircle size={12} color="var(--danger)" style={{ flexShrink: 0 }} />
                  }
                  <span style={{ color: r.ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '.78rem', minWidth: 160 }}>
                    {TIENDA_NOMBRES[r.key]}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
