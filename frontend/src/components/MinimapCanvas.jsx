import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'

const EVENT_COLORS = {
  Kill:          '#ef4444',
  Killed:        '#f97316',
  BotKill:       '#ef4444',
  BotKilled:     '#f97316',
  KilledByStorm: '#a855f7',
  Loot:          '#22c55e',
}

const EVENT_ICONS = {
  Kill:          '⚔',
  Killed:        '💀',
  BotKill:       '⚔',
  BotKilled:     '💀',
  KilledByStorm: '🌀',
  Loot:          '●',
}

const MOVEMENT_EVENTS = new Set(['Position', 'BotPosition'])

// Scale factor: minimap data is 1024x1024, we need to scale to display size
const DATA_SIZE = 1024

export default function MinimapCanvas({ events, tsNow, mapId, heatmapData, heatmapMode }) {
  const containerRef  = useRef(null)
  const canvasRef     = useRef(null)
  const heatCanvasRef = useRef(null)
  const imgRef        = useRef(null)
  const [canvasSize, setCanvasSize] = useState(600)
  const [tooltip,    setTooltip]    = useState(null)
  const [imgLoaded,  setImgLoaded]  = useState(false)
  const [imgError,   setImgError]   = useState(false)

  // ── Map image source ────────────────────────────────────────────────────
  const mapImageSrc = useMemo(() => {
    const ext = mapId === 'Lockdown' ? 'jpg' : 'png'
    return `/${mapId}_Minimap.${ext}`
  }, [mapId])

  // ── Resize observer ─────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const size = Math.min(entry.contentRect.width, entry.contentRect.height) - 20
        setCanvasSize(Math.max(300, size))
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Preload map image ───────────────────────────────────────────────────
  useEffect(() => {
    setImgLoaded(false); setImgError(false)
    const img = new Image()
    img.src = mapImageSrc
    img.onload  = () => { imgRef.current = img; setImgLoaded(true) }
    img.onerror = () => { setImgError(true) }
  }, [mapImageSrc])

  // ── Group events by player ──────────────────────────────────────────────
  const { playerPaths, discreteEvents } = useMemo(() => {
    const visible = events.filter(e => e.ts <= tsNow)
    const paths   = {}
    const discrete = []

    for (const ev of visible) {
      if (MOVEMENT_EVENTS.has(ev.event_type)) {
        if (!paths[ev.user_id]) {
          paths[ev.user_id] = { points: [], isBot: ev.is_bot }
        }
        paths[ev.user_id].points.push({ px: ev.px, py: ev.py })
      } else if (EVENT_COLORS[ev.event_type]) {
        discrete.push(ev)
      }
    }
    return { playerPaths: paths, discreteEvents: discrete }
  }, [events, tsNow])

  // ── Scale coordinate 0-1024 → canvas pixels ─────────────────────────────
  const scale = useCallback((v) => (v / DATA_SIZE) * canvasSize, [canvasSize])

  // ── Draw main canvas ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasSize, canvasSize)

    // Draw minimap background
    ctx.drawImage(imgRef.current, 0, 0, canvasSize, canvasSize)

    // Draw player paths
    for (const [userId, { points, isBot }] of Object.entries(playerPaths)) {
      if (points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(scale(points[0].px), scale(points[0].py))
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(scale(points[i].px), scale(points[i].py))
      }
      if (isBot) {
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = 'rgba(248,113,113,0.6)'
        ctx.lineWidth = 1.5
      } else {
        ctx.setLineDash([])
        ctx.strokeStyle = 'rgba(96,165,250,0.75)'
        ctx.lineWidth = 2
      }
      ctx.stroke()

      // Draw current position dot
      const last = points[points.length - 1]
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(scale(last.px), scale(last.py), isBot ? 3 : 4, 0, Math.PI * 2)
      ctx.fillStyle = isBot ? '#f87171' : '#60a5fa'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw discrete event markers
    ctx.setLineDash([])
    for (const ev of discreteEvents) {
      const x = scale(ev.px)
      const y = scale(ev.py)
      const color = EVENT_COLORS[ev.event_type]

      // Outer glow circle
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fillStyle = color + '40'
      ctx.fill()

      // Inner circle
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }, [playerPaths, discreteEvents, canvasSize, imgLoaded])

  // ── Draw heatmap overlay ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = heatCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasSize, canvasSize)
    if (!heatmapMode || heatmapData.length === 0) return

    // Bucket into grid cells
    const GRID = 48 // increased grid precision for circles
    const cellSize = canvasSize / GRID
    const grid = Array(GRID).fill(null).map(() => Array(GRID).fill(0))
    let maxVal = 0

    for (const { px, py } of heatmapData) {
      const gx = Math.floor((px / DATA_SIZE) * GRID)
      const gy = Math.floor((py / DATA_SIZE) * GRID)
      if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
        grid[gy][gx]++
        if (grid[gy][gx] > maxVal) maxVal = grid[gy][gx]
      }
    }

    if (maxVal === 0) return

    let r=255, g=0, b=0;
    if (heatmapMode === 'kills') { r=239; g=68; b=68; }
    else if (heatmapMode === 'deaths') { r=249; g=115; b=22; }
    else if (heatmapMode === 'storm') { r=168; g=85; b=247; }
    else if (heatmapMode === 'loot') { r=34; g=197; b=94; }
    else if (heatmapMode === 'traffic') { r=59; g=130; b=246; }

    ctx.globalCompositeOperation = 'screen' // makes overlapping paths brighter

    const mapScale = canvasSize / DATA_SIZE
    const radius = cellSize * 2.5 // radius of heat circle

    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const val = grid[gy][gx]
        if (val === 0) continue
        
        let intensity = val / maxVal
        // Curve the intensity to make lower values more visible but high values pop
        intensity = Math.min(1, Math.pow(intensity, 0.6) * 1.5)
        
        const cx = gx * cellSize + cellSize / 2
        const cy = gy * cellSize + cellSize / 2
        
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`)
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        
        ctx.fillStyle = grad
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
      }
    }
    
    ctx.globalCompositeOperation = 'source-over'
  }, [heatmapData, heatmapMode, canvasSize])

  // ── Tooltip on mouse move ─────────────────────────────────────────────────
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / canvasSize) * DATA_SIZE
    const my = ((e.clientY - rect.top) / canvasSize) * DATA_SIZE
    const RADIUS = 20

    const near = discreteEvents.find(ev =>
      Math.abs(ev.px - mx) < RADIUS && Math.abs(ev.py - my) < RADIUS
    )
    if (near) {
      setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 30, ev: near })
    } else {
      setTooltip(null)
    }
  }

  if (imgError) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="canvas-placeholder">
          <div className="canvas-placeholder-icon" style={{ fontSize: 32 }}>⚠️</div>
          <p style={{ color: '#f97316' }}>Failed to load minimap for {mapId}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div style={{ position: 'relative', width: canvasSize, height: canvasSize }}>
        {/* Main canvas */}
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{ position: 'absolute', top: 0, left: 0, borderRadius: 8, display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
        {/* Heatmap canvas on top */}
        <canvas
          ref={heatCanvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{ position: 'absolute', top: 0, left: 0, borderRadius: 8, pointerEvents: 'none' }}
        />
        {/* Tooltip */}
        {tooltip && (
          <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <strong>{EVENT_ICONS[tooltip.ev.event_type]} {tooltip.ev.event_type}</strong>
            <br />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {tooltip.ev.is_bot ? 'Bot' : 'Player'}: {tooltip.ev.user_id.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
