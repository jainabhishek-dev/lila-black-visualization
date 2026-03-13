import React from 'react'

export default function PlaybackTimeline({
  tsMin, tsMax, tsNow, playing, speed,
  onPlayPause, onSeek, onSpeedChange, disabled
}) {
  const duration = Math.max(tsMax - tsMin, 1)
  const elapsed  = Math.max(0, tsNow - tsMin)
  const progress = Math.min(100, (elapsed / duration) * 100)

  const formatTime = (ms) => {
    const totalSecs = ms / 1000
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0')
    const s = Math.floor(totalSecs % 60).toString().padStart(2, '0')
    const centi = Math.floor((ms % 1000) / 10).toString().padStart(2, '0')
    return `${m}:${s}.${centi}`
  }

  const durSecs = duration / 1000
  const totalM = Math.floor(durSecs / 60).toString().padStart(2, '0')
  const totalS = Math.floor(durSecs % 60).toString().padStart(2, '0')
  const totalCenti = Math.floor((duration % 1000) / 10).toString().padStart(2, '0')

  const handleTrackClick = (e) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(tsMin + ratio * duration)
  }

  return (
    <div className="timeline-bar">
      <button
        className="play-btn"
        onClick={onPlayPause}
        disabled={disabled}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <div
        className="timeline-track"
        onClick={handleTrackClick}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <div className="timeline-fill" style={{ width: `${progress}%` }} />
        <div className="timeline-thumb" style={{ left: `${progress}%` }} />
      </div>

      <span className="timeline-time">
        {formatTime(elapsed)} / {totalM}:{totalS}.{totalCenti}
      </span>

      {[1, 2, 4].map(s => (
        <button
          key={s}
          className={`speed-btn ${speed === s ? 'active' : ''}`}
          onClick={() => onSpeedChange(s)}
          disabled={disabled}
        >
          {s}×
        </button>
      ))}
    </div>
  )
}
