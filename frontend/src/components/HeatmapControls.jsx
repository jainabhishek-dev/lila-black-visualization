import React from 'react'

const HEATMAP_OPTIONS = [
  { key: 'kills',   label: 'Kill Zones',    icon: '⚔️',  color: 'var(--accent-kill)' },
  { key: 'deaths',  label: 'Death Zones',   icon: '💀',  color: 'var(--accent-death)' },
  { key: 'storm',   label: 'Storm Deaths',  icon: '🌀',  color: 'var(--accent-storm)' },
  { key: 'loot',    label: 'Loot Zones',    icon: '📦',  color: 'var(--accent-loot)' },
  { key: 'traffic', label: 'High Traffic',  icon: '🗺️',  color: 'var(--accent)' },
]

export default function HeatmapControls({ heatmapMode, onModeChange }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-label">Heatmap Overlay</div>
      <div className="heatmap-buttons">
        {HEATMAP_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`heatmap-btn ${heatmapMode === opt.key ? 'active' : ''}`}
            onClick={() => onModeChange(heatmapMode === opt.key ? null : opt.key)}
            style={heatmapMode === opt.key ? { borderColor: opt.color, color: opt.color } : {}}
          >
            <span>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
        {heatmapMode && (
          <button className="heatmap-btn" onClick={() => onModeChange(null)}
            style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            ✕ Clear overlay
          </button>
        )}
      </div>
    </div>
  )
}
