import React from 'react'

const LEGEND_ITEMS = [
  { type: 'line', color: '#60a5fa',  label: 'Human path',  dash: false },
  { type: 'line', color: '#f87171',  label: 'Bot path',    dash: true  },
  { type: 'dot',  color: '#ef4444',  label: 'Kill' },
  { type: 'dot',  color: '#f97316',  label: 'Death' },
  { type: 'dot',  color: '#22c55e',  label: 'Loot' },
  { type: 'dot',  color: '#a855f7',  label: 'Storm death' },
]

export default function LegendPanel() {
  return (
    <div className="legend">
      <div className="sidebar-label" style={{ marginBottom: 10 }}>Legend</div>
      <div className="legend-grid">
        {LEGEND_ITEMS.map((item, i) => (
          <div key={i} className="legend-item">
            {item.type === 'line' ? (
              <div className="legend-line" style={{
                background: item.color,
                ...(item.dash ? {
                  background: 'none',
                  borderTop: `2px dashed ${item.color}`,
                  height: 0,
                } : {})
              }} />
            ) : (
              <div className="legend-dot" style={{ background: item.color }} />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
