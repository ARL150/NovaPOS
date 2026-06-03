import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  trend?: string
  color?: string   // custom color hex/var
  variant?: 'default' | 'accent'
}

export default function StatCard({ icon: Icon, label, value, sub, trend, color }: Props) {
  const isUp   = trend?.startsWith('+')
  const isDown = trend?.startsWith('-')

  const c = color || 'var(--accent)'

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${c}40`,
      background: `${c}08`,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 2px 12px ${c}12`,
      transition: 'box-shadow .2s',
    }}>

      {/* Barra de color arriba */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${c}, ${c}55)`,
        borderRadius: '14px 14px 0 0',
      }} />

      {/* Brillo decorativo fondo */}
      <div style={{
        position: 'absolute', top: -30, right: -20, width: 90, height: 90,
        borderRadius: '50%', background: `${c}0d`, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            color: 'var(--text-muted)', fontSize: '.68rem', fontWeight: 700,
            letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            {label}
          </p>
          <p style={{
            color: 'var(--text-h)', fontSize: '1.5rem', fontWeight: 800,
            lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {value}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {sub && (
              <p style={{ color: 'var(--text-muted)', fontSize: '.71rem' }}>{sub}</p>
            )}
            {trend && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: '.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                background: isUp ? 'var(--success-bg)' : isDown ? 'var(--danger-bg)' : 'var(--surface2)',
                color: isUp ? 'var(--success)' : isDown ? 'var(--danger)' : 'var(--text-muted)',
                border: `1px solid ${isUp ? 'rgba(63,185,80,.25)' : isDown ? 'rgba(248,81,73,.25)' : 'var(--border)'}`,
              }}>
                {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : null}
                {trend}
              </span>
            )}
          </div>
        </div>

        {/* Ícono */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: `${c}18`,
          border: `1px solid ${c}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={c} />
        </div>
      </div>
    </div>
  )
}
