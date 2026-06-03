import { useEffect, useState, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import api from '../lib/api'
import {
  Database, Server, RefreshCw, Package, ShoppingCart,
  Users, UserCircle, WifiOff, Search, ChevronRight,
  Pencil, Save, X, AlertTriangle, Check, DatabaseZap,
  Layers, ChevronDown, ChevronLeft, Hash, Type, ToggleLeft,
  Braces, Eye, EyeOff, ShieldAlert, ShieldCheck,
} from 'lucide-react'

/* ── Colecciones ─────────────────────────────────── */
const COL_META: Record<string, { icon: LucideIcon; color: string; label: string; desc: string }> = {
  productos: { icon: Package,      color: '#58a6ff', label: 'Productos',  desc: 'Catálogo de mercancías' },
  ventas:    { icon: ShoppingCart, color: '#3fb950', label: 'Ventas',     desc: 'Historial de transacciones' },
  usuarios:  { icon: Users,        color: '#d29922', label: 'Usuarios',   desc: 'Cuentas del sistema' },
  clientes:  { icon: UserCircle,   color: '#a78bfa', label: 'Clientes',   desc: 'Perfiles de clientes' },
}

/* ── Tipos ───────────────────────────────────────── */
interface ColInfo  { nombre: string; documentos: number }
interface BaseInfo { nombre: string; label: string; colecciones: ColInfo[]; total_docs: number; prefijo?: string }
interface NodoInfo { nodo: number; puerto: number; activo: boolean; bases: BaseInfo[]; recovery?: boolean }

/* ── Icono de tipo de valor ──────────────────────── */
function TypeIcon({ v }: { v: any }) {
  if (v === null || v === undefined) return <span style={{ color: 'var(--text-muted)', fontSize: '.65rem' }}>null</span>
  if (typeof v === 'number')  return <Hash size={10} color="#3fb950" />
  if (typeof v === 'boolean') return <ToggleLeft size={10} color="#d29922" />
  if (typeof v === 'object')  return <Braces size={10} color="#58a6ff" />
  return <Type size={10} color="var(--text-muted)" />
}

function fmtVal(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > 60 ? s.slice(0, 60) + '…' : s
  }
  return String(v)
}

function valColor(v: any, key: string) {
  if (key === '_id') return 'var(--text-muted)'
  if (v === null || v === undefined) return 'var(--text-muted)'
  if (typeof v === 'number')  return '#3fb950'
  if (typeof v === 'boolean') return '#d29922'
  if (typeof v === 'object')  return '#58a6ff'
  return 'var(--text)'
}

/* ── Modal de confirmación ───────────────────────── */
function ConfirmModal({ onConfirm, onCancel, db, col, changes }: {
  onConfirm: () => void; onCancel: () => void
  db: string; col: string; changes: Record<string, any>
}) {
  const [countdown, setCountdown] = useState(3)
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: 500, padding: 0, overflow: 'hidden',
        animation: 'fadeUp .22s cubic-bezier(.16,1,.3,1)',
        border: '1px solid var(--warning)',
      }}>
        {/* Cabecera del modal */}
        <div style={{
          background: 'var(--warning-bg)', borderBottom: '1px solid var(--warning)',
          padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'rgba(210,153,34,.2)', border: '2px solid var(--warning)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={22} color="var(--warning)" />
          </div>
          <div>
            <p style={{ color: 'var(--warning)', fontWeight: 800, fontSize: '1.05rem', marginBottom: 2 }}>
              ⚠️ ¿Estás seguro?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>
              Vas a modificar un documento en{' '}
              <code style={{ color: 'var(--accent)', background: 'var(--accent-bg)', padding: '1px 5px', borderRadius: 3, fontSize: '.75rem' }}>
                {db} › {col}
              </code>
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px 28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
            Campos que serán modificados
          </p>
          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 18,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {Object.entries(changes).map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '5px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '.73rem', minWidth: 110, flexShrink: 0, paddingTop: 1 }}>
                  {k}
                </span>
                <span style={{ color: 'var(--text)', fontSize: '.73rem', wordBreak: 'break-all', flex: 1 }}>
                  {fmtVal(v)}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'rgba(210,153,34,.08)', borderRadius: 8, marginBottom: 20,
            border: '1px solid rgba(210,153,34,.25)',
          }}>
            <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
            <p style={{ color: 'var(--warning)', fontSize: '.75rem', lineHeight: 1.4 }}>
              Esta acción <strong>no se puede deshacer</strong>. Los datos anteriores se perderán permanentemente.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onCancel} style={{ gap: 6 }}>
              <X size={14} /> Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={countdown <= 0 ? onConfirm : undefined}
              disabled={countdown > 0}
              style={{
                gap: 6,
                background: countdown > 0 ? 'var(--surface2)' : 'var(--warning)',
                borderColor: countdown > 0 ? 'var(--border)' : 'var(--warning)',
                color: countdown > 0 ? 'var(--text-muted)' : '#fff',
                cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                transition: 'all .3s',
                minWidth: 160,
              }}
            >
              {countdown > 0
                ? <><RefreshCw size={12} className="spin" /> Espera {countdown}s…</>
                : <><Check size={14} /> Sí, modificar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Tarjeta de documento ────────────────────────── */
function DocCard({ doc, keys, onEdit }: {
  doc: any; keys: string[]; onEdit: (doc: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleKeys = keys.filter(k => k !== 'password')
  const previewKeys = visibleKeys.filter(k => k !== '_id').slice(0, 3)
  const allKeys = expanded ? visibleKeys : previewKeys

  return (
    <div className="card" style={{
      padding: 0, overflow: 'hidden', transition: 'box-shadow .15s',
    }}>
      {/* Header de la tarjeta */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
      }}>
        <code style={{ color: 'var(--text-muted)', fontSize: '.62rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc._id}
        </code>
        <button
          className="btn btn-ghost"
          style={{ padding: '3px 7px', gap: 4, color: 'var(--accent)', fontSize: '.7rem' }}
          onClick={() => onEdit(doc)}
          title="Editar documento"
        >
          <Pencil size={11} /> Editar
        </button>
      </div>

      {/* Campos */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {allKeys.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 110, flexShrink: 0, paddingTop: 2 }}>
              <TypeIcon v={doc[k]} />
              <span style={{ color: 'var(--text-muted)', fontSize: '.7rem', fontFamily: 'monospace' }}>{k}</span>
            </div>
            <span style={{
              color: valColor(doc[k], k), fontSize: '.76rem',
              wordBreak: 'break-all', fontFamily: (k === '_id' || typeof doc[k] === 'number') ? 'monospace' : 'inherit',
            }}>
              {fmtVal(doc[k])}
            </span>
          </div>
        ))}
      </div>

      {/* Expandir */}
      {visibleKeys.filter(k => k !== '_id').length > 3 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            width: '100%', padding: '6px', borderTop: '1px solid var(--border)',
            background: 'var(--surface2)', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '.68rem',
          }}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {expanded ? 'Mostrar menos' : `Ver ${visibleKeys.filter(k => k !== '_id').length - 3} campos más`}
        </button>
      )}
    </div>
  )
}

/* ── Panel lateral de edición ────────────────────── */
function EditPanel({ doc, keys, db, col, onClose, onSaved }: {
  doc: any; keys: string[]; db: string; col: string
  onClose: () => void; onSaved: () => void
}) {
  const editableKeys = keys.filter(k => k !== '_id' && k !== 'password')
  const [draft, setDraft]             = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    editableKeys.forEach(k => { d[k] = typeof doc[k] === 'object' ? JSON.stringify(doc[k]) : String(doc[k] ?? '') })
    return d
  })
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null)
  const [showPw, setShowPw]           = useState(false)

  const tryParse = (v: string) => { try { return JSON.parse(v) } catch { return v } }

  const doSave = async () => {
    setSaving(true); setShowConfirm(false)
    const payload: Record<string, any> = {}
    Object.entries(draft).forEach(([k, v]) => { payload[k] = tryParse(v) })
    try {
      await api.patch(`/explorer/${db}/${col}/${doc._id}`, payload)
      setMsg({ ok: true, text: 'Documento actualizado correctamente.' })
      setTimeout(() => { onSaved(); onClose() }, 1400)
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.detail || 'Error al guardar.' })
      setSaving(false)
    }
  }

  const changes = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, tryParse(v)]))

  const typeLabel = (v: any) => {
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'number')  return 'número'
    if (typeof v === 'boolean') return 'booleano'
    if (typeof v === 'object')  return 'objeto JSON'
    return 'texto'
  }

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          db={db} col={col} changes={changes}
          onConfirm={doSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Fondo oscuro */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)' }}
      />

      {/* Panel deslizante */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 950,
        width: '100%', maxWidth: 460,
        background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .28s cubic-bezier(.16,1,.3,1)',
        boxShadow: '-20px 0 60px rgba(0,0,0,.5)',
      }}>

        {/* ── Cabecera ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Pencil size={16} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-h)', fontWeight: 800, fontSize: '.92rem' }}>
              Editar documento
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '.68rem' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{db}</span>
              <span style={{ margin: '0 4px', opacity: .5 }}>›</span>
              <span style={{ fontFamily: 'monospace' }}>{col}</span>
            </p>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: 8 }}
            onClick={onClose}
            title="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── ID (solo lectura) ── */}
        <div style={{
          padding: '10px 20px', background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.07em', color: 'var(--text-muted)', flexShrink: 0,
          }}>_id</span>
          <code style={{
            color: 'var(--text-muted)', fontSize: '.7rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{doc._id}</code>
          <span style={{
            fontSize: '.6rem', background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: 4, padding: '1px 6px', flexShrink: 0,
          }}>solo lectura</span>
        </div>

        {/* ── Campos editables ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Mensaje de éxito / error */}
          {msg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderRadius: 10, marginBottom: 18,
              background: msg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${msg.ok ? 'var(--success)' : 'var(--danger)'}`,
            }}>
              {msg.ok
                ? <Check size={15} color="var(--success)" />
                : <AlertTriangle size={15} color="var(--danger)" />
              }
              <p style={{
                color: msg.ok ? 'var(--success)' : 'var(--danger)',
                fontSize: '.82rem', fontWeight: 600,
              }}>{msg.text}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {editableKeys.map(k => (
              <div key={k}>
                {/* Label del campo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <TypeIcon v={doc[k]} />
                  <span style={{
                    color: 'var(--text-h)', fontSize: '.8rem',
                    fontWeight: 700, fontFamily: 'monospace',
                  }}>{k}</span>
                  <span style={{
                    fontSize: '.62rem', color: 'var(--text-muted)',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '1px 6px',
                  }}>{typeLabel(doc[k])}</span>
                </div>

                {/* Input */}
                {k === 'password' ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={draft[k] ?? ''}
                      onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      autoComplete="new-password"
                      style={{ width: '100%', paddingRight: 40, fontSize: '.85rem', padding: '10px 40px 10px 12px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      }}
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                ) : (
                  <input
                    value={draft[k] ?? ''}
                    onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                    autoComplete="off"
                    placeholder={`Escribe el valor de ${k}…`}
                    style={{ width: '100%', fontSize: '.85rem', padding: '10px 12px' }}
                  />
                )}

                {/* Valor original (referencia) */}
                {draft[k] !== String(doc[k] ?? '') && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '.68rem', marginTop: 4 }}>
                    Antes: <span style={{ fontFamily: 'monospace', color: 'var(--danger)' }}>{fmtVal(doc[k])}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Pie de acciones ── */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', gap: 10,
        }}>
          <button className="btn btn-secondary" style={{ flex: 1, gap: 6 }} onClick={onClose}>
            <X size={14} /> Cancelar
          </button>
          <button
            className="btn btn-primary"
            style={{
              flex: 2, gap: 6,
              background: 'var(--warning)', borderColor: 'var(--warning)',
              fontWeight: 700,
            }}
            disabled={saving}
            onClick={() => setShowConfirm(true)}
          >
            {saving
              ? <><RefreshCw size={13} className="spin" /> Guardando…</>
              : <><Save size={13} /> Guardar cambios</>
            }
          </button>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════ */
export default function Explorer() {
  const [nodos, setNodos]         = useState<NodoInfo[]>([])
  const [loadingTree, setLT]      = useState(true)
  const [expandedNodos, setExpNodos] = useState<Set<number>>(new Set([1, 2, 3, 4]))
  const [selBase, setSelBase]     = useState<string | null>(null)
  const [selCol, setSelCol]       = useState<string | null>(null)

  const [docs, setDocs]           = useState<any[]>([])
  const [keys, setKeys]           = useState<string[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [buscar, setBuscar]       = useState('')
  const [loadingDocs, setLD]      = useState(false)
  const buscarRef                 = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [editDoc, setEditDoc]     = useState<any | null>(null)

  const LIMIT = 9

  const loadTree = () => {
    setLT(true)
    api.get('/explorer/nodos').then(r => setNodos(r.data)).finally(() => setLT(false))
  }
  useEffect(() => { loadTree() }, [])

  const loadDocs = (db: string, col: string, p: number, q: string) => {
    setLD(true)
    api.get(`/explorer/${db}/${col}?page=${p}&limit=${LIMIT}&q=${encodeURIComponent(q)}`)
      .then(r => { setDocs(r.data.docs); setKeys(r.data.keys); setTotal(r.data.total) })
      .catch(() => { setDocs([]); setKeys([]) })
      .finally(() => setLD(false))
  }

  const selectCol = (db: string, col: string) => {
    setSelBase(db); setSelCol(col); setPage(1); setBuscar('')
    setEditDoc(null)
    loadDocs(db, col, 1, '')
  }

  const onSearch = (q: string) => {
    setBuscar(q); setPage(1)
    clearTimeout(buscarRef.current)
    buscarRef.current = setTimeout(() => {
      if (selBase && selCol) loadDocs(selBase, selCol, 1, q)
    }, 320)
  }

  const toggleNodo = (n: number) => setExpNodos(s => {
    const ns = new Set(s)
    ns.has(n) ? ns.delete(n) : ns.add(n)
    return ns
  })

  const totalPages = Math.ceil(total / LIMIT)
  const currentColMeta = selCol ? (COL_META[selCol] || { icon: Layers, color: 'var(--text-muted)', label: selCol, desc: '' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Edit panel */}
      {editDoc && selBase && selCol && (
        <EditPanel
          doc={editDoc} keys={keys} db={selBase} col={selCol}
          onClose={() => setEditDoc(null)}
          onSaved={() => { if (selBase && selCol) loadDocs(selBase, selCol, page, buscar) }}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DatabaseZap size={20} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text-h)', fontSize: '1.25rem', fontWeight: 800, marginBottom: 2 }}>
              Explorador de Bases de Datos
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.76rem' }}>
              MongoDB distribuido · 4 nodos (Nodo 4: réplica global) · lectura y escritura con confirmación
            </p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={loadTree} style={{ gap: 6 }}>
          <RefreshCw size={13} className={loadingTree ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {/* ── Tarjetas de nodos ── */}
      {loadingTree ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[1,2,3,4].map(n => (
            <div key={n} className="card" style={{ padding: 20, opacity: .35, animation: 'pulse 1.2s infinite' }}>
              <div style={{ height: 14, background: 'var(--surface2)', borderRadius: 6, marginBottom: 10 }} />
              <div style={{ height: 9, background: 'var(--surface2)', borderRadius: 4, width: '55%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {nodos.map(nodo => {
            const isRecovery = nodo.recovery === true
            // Colores según tipo de nodo
            const activeColor  = isRecovery ? '#58a6ff' : 'var(--success)'
            const activeBg     = isRecovery ? '#58a6ff18' : 'var(--success-bg)'
            const activeBorder = isRecovery ? '#58a6ff55' : 'var(--success)'
            const headerBg     = !nodo.activo ? 'var(--danger-bg)'
              : selBase && nodo.bases.some(b => b.nombre === selBase) ? (isRecovery ? '#58a6ff12' : 'var(--accent-bg)')
              : 'var(--surface2)'
            const cardBorder   = !nodo.activo ? 'var(--danger)'
              : selBase && nodo.bases.some(b => b.nombre === selBase) ? (isRecovery ? '#58a6ff' : 'var(--accent-border)')
              : isRecovery ? '#58a6ff30' : 'var(--border)'

            return (
            <div key={nodo.nodo} className="card" style={{
              padding: 0, overflow: 'hidden',
              border: `1px solid ${cardBorder}`,
              boxShadow: isRecovery && nodo.activo ? '0 0 0 1px #58a6ff22, 0 4px 20px #58a6ff0a' : undefined,
            }}>
              {/* Barra superior de color para nodo 4 */}
              {isRecovery && (
                <div style={{
                  height: 3,
                  background: nodo.activo
                    ? 'linear-gradient(90deg, #58a6ff, #a78bfa)'
                    : 'linear-gradient(90deg, var(--danger), var(--danger)55)',
                }} />
              )}

              {/* Header del nodo */}
              <button
                onClick={() => toggleNodo(nodo.nodo)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                  width: '100%', background: headerBg,
                  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                {/* Pulso de estado */}
                <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                  {nodo.activo && (
                    <div style={{
                      position: 'absolute', inset: -3, borderRadius: '50%',
                      background: activeColor, opacity: .18,
                      animation: 'ping 1.8s cubic-bezier(0,0,.2,1) infinite',
                    }} />
                  )}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: nodo.activo ? activeBg : 'var(--danger-bg)',
                    border: `2px solid ${nodo.activo ? activeBorder : 'var(--danger)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {nodo.activo
                      ? (isRecovery ? <ShieldCheck size={14} color="#58a6ff" /> : <Server size={14} color="var(--success)" />)
                      : <WifiOff size={14} color="var(--danger)" />
                    }
                  </div>
                </div>

                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: '.88rem', lineHeight: 1.2 }}>
                      Nodo {nodo.nodo}
                    </p>
                    {isRecovery && (
                      <span style={{
                        fontSize: '.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                        background: '#58a6ff20', color: '#58a6ff', border: '1px solid #58a6ff40',
                        textTransform: 'uppercase', letterSpacing: '.06em',
                      }}>Réplica</span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', fontFamily: 'monospace' }}>
                    localhost:{nodo.puerto} · {nodo.bases.length} bases
                  </p>
                </div>

                <span className={`badge ${nodo.activo ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '.6rem' }}>
                  {nodo.activo ? '● Online' : '○ Offline'}
                </span>

                {expandedNodos.has(nodo.nodo)
                  ? <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  : <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                }
              </button>

              {/* Bases del nodo */}
              {expandedNodos.has(nodo.nodo) && (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                  {nodo.bases.map(base => {
                    const selColor = isRecovery ? '#58a6ff' : 'var(--accent)'
                    const selBg    = isRecovery ? '#58a6ff12' : 'var(--accent-bg)'
                    const selBord  = isRecovery ? '#58a6ff40' : 'var(--accent-border)'
                    return (
                    <button
                      key={base.nombre}
                      onClick={() => nodo.activo && setSelBase(selBase === base.nombre ? null : base.nombre)}
                      disabled={!nodo.activo}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px',
                        borderRadius: 7, border: '1px solid', cursor: nodo.activo ? 'pointer' : 'not-allowed',
                        background: selBase === base.nombre ? selBg : 'transparent',
                        borderColor: selBase === base.nombre ? selBord : 'transparent',
                        transition: 'all .12s', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (selBase !== base.nombre && nodo.activo) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { if (selBase !== base.nombre) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Database size={11} color={selBase === base.nombre ? selColor : 'var(--text-muted)'} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', color: selBase === base.nombre ? selColor : 'var(--text)',
                          fontSize: '.73rem', fontWeight: selBase === base.nombre ? 700 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {base.label || base.nombre}
                        </span>
                        {isRecovery && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '.6rem', fontFamily: 'monospace' }}>
                            {base.nombre}
                          </span>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '.62rem', fontFamily: 'monospace', flexShrink: 0 }}>
                        {base.total_docs.toLocaleString()}
                      </span>
                    </button>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* ── Colecciones ── */}
      {selBase && (() => {
        const nodo = nodos.find(n => n.bases.some(b => b.nombre === selBase))
        const base = nodo?.bases.find(b => b.nombre === selBase)
        if (!base) return null
        return (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
              Colecciones de{' '}
              <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{selBase}</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {base.colecciones.map(col => {
                const meta = COL_META[col.nombre] || { icon: Layers, color: 'var(--text-muted)', label: col.nombre, desc: '' }
                const ColIcon = meta.icon
                const active = selCol === col.nombre
                return (
                  <button
                    key={col.nombre}
                    onClick={() => selectCol(selBase, col.nombre)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                      padding: '16px', borderRadius: 12, border: '1px solid', cursor: 'pointer',
                      background: active ? meta.color + '12' : 'var(--surface)',
                      borderColor: active ? meta.color : 'var(--border)',
                      transition: 'all .15s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = meta.color + '80'; (e.currentTarget as HTMLElement).style.background = meta.color + '08' } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' } }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: active ? meta.color + '25' : 'var(--surface2)',
                      border: `1px solid ${active ? meta.color + '60' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ColIcon size={17} color={active ? meta.color : 'var(--text-muted)'} />
                    </div>
                    <div>
                      <p style={{ color: active ? 'var(--text-h)' : 'var(--text)', fontWeight: 700, fontSize: '.82rem', marginBottom: 2 }}>
                        {meta.label}
                      </p>
                      <p style={{ color: active ? meta.color : 'var(--text-muted)', fontSize: '.7rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {col.documentos.toLocaleString()} docs
                      </p>
                      {meta.desc && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '.65rem', marginTop: 2 }}>{meta.desc}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Documentos ── */}
      {selBase && selCol && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Barra de búsqueda + info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {currentColMeta && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <currentColMeta.icon size={15} color={currentColMeta.color} />
                <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{selBase}</span>
                <ChevronRight size={13} color="var(--text-muted)" />
                <span style={{ color: currentColMeta.color, fontWeight: 700, fontSize: '.88rem' }}>{selCol}</span>
                <span className="badge badge-muted" style={{ fontSize: '.65rem' }}>{total.toLocaleString()} documentos</span>
              </div>
            )}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                value={buscar}
                onChange={e => onSearch(e.target.value)}
                placeholder="Buscar…"
                style={{ paddingLeft: 30, width: 200, fontSize: '.78rem' }}
              />
            </div>
          </div>

          {/* Grid de tarjetas */}
          {loadingDocs ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {Array.from({ length: LIMIT }).map((_, i) => (
                <div key={i} className="card" style={{ padding: 16, opacity: .35, animation: 'pulse 1.4s infinite' }}>
                  <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 4, marginBottom: 8, width: '70%' }} />
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, marginBottom: 5 }} />
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, width: '55%' }} />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <DatabaseZap size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: .2 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>Sin documentos que coincidan</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {docs.map(doc => (
                <DocCard key={doc._id} doc={doc} keys={keys} onEdit={setEditDoc} />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>
                Página {page} / {totalPages} · {total.toLocaleString()} documentos
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary" style={{ padding: '4px 9px' }} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); loadDocs(selBase!, selCol!, p, buscar) }}>
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p}
                      className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', minWidth: 34, fontSize: '.78rem' }}
                      onClick={() => { setPage(p); loadDocs(selBase!, selCol!, p, buscar) }}>
                      {p}
                    </button>
                  )
                })}
                <button className="btn btn-secondary" style={{ padding: '4px 9px' }} disabled={page >= totalPages}
                  onClick={() => { const p = page + 1; setPage(p); loadDocs(selBase!, selCol!, p, buscar) }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
