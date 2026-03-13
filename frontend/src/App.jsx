import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchMaps, fetchDates, fetchMatches, fetchMatchEvents, fetchHeatmapData } from './api/supabaseClient'
import FilterBar from './components/FilterBar'
import MinimapCanvas from './components/MinimapCanvas'
import PlaybackTimeline from './components/PlaybackTimeline'
import LegendPanel from './components/LegendPanel'
import HeatmapControls from './components/HeatmapControls'
import MatchSelectorModal from './components/MatchSelectorModal'
import './index.css'

export default function App() {
  // ── Filters ──────────────────────────────────────────────────────────────
  const [maps, setMaps]       = useState([])
  const [dates, setDates]     = useState([])
  const [matchList, setMatchList] = useState([])

  const [selectedMap,   setSelectedMap]   = useState('')
  const [selectedDate,  setSelectedDate]  = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)

  // ── Events ───────────────────────────────────────────────────────────────
  const [events,   setEvents]  = useState([])
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState(null)

  // ── Playback ─────────────────────────────────────────────────────────────
  const [tsMin,    setTsMin]    = useState(0)
  const [tsMax,    setTsMax]    = useState(0)
  const [tsNow,    setTsNow]    = useState(0)
  const [playing,  setPlaying]  = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  // ── Heatmap ──────────────────────────────────────────────────────────────
  const [heatmapMode, setHeatmapMode] = useState(null) // null | 'kills' | 'deaths' | 'storm' | 'loot' | 'traffic'
  const [heatmapData, setHeatmapData] = useState([])

  // ── Load maps on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetchMaps()
      .then(m => { setMaps(m); if (m.length) setSelectedMap(m[0]) })
      .catch(err => setError(`Failed to load maps: ${err.message}`))
  }, [])

  // ── Load dates when map changes ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedMap) return
    setSelectedDate(''); setSelectedMatch(null); setEvents([]); setError(null)
    fetchDates(selectedMap)
      .then(d => { setDates(d); if (d.length) setSelectedDate(d[0]) })
      .catch(err => setError(`Failed to load dates: ${err.message}`))
  }, [selectedMap])

  // ── Load matches when map+date change ───────────────────────────────────
  const [matchesLoading, setMatchesLoading] = useState(false)
  useEffect(() => {
    if (!selectedMap || !selectedDate) return
    setSelectedMatch(null); setEvents([]); setMatchesLoading(true)
    fetchMatches(selectedMap, selectedDate)
      .then(data => { setMatchList(data); setMatchesLoading(false) })
      .catch(err => { setError(`Failed to load matches: ${err.message}`); setMatchesLoading(false) })
  }, [selectedMap, selectedDate])

  // ── Load events when match selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedMatch) return
    setLoading(true); setPlaying(false); setEvents([]); setError(null)
    fetchMatchEvents(selectedMatch.match_id)
      .then(data => {
        setEvents(data)
        if (data.length) {
          // Use reduce to avoid stack overflow on large arrays (Math.min/max spread fails >~10k items)
          const min = data.reduce((acc, e) => e.ts < acc ? e.ts : acc, data[0].ts)
          const max = data.reduce((acc, e) => e.ts > acc ? e.ts : acc, data[0].ts)
          setTsMin(min); setTsMax(max); setTsNow(min)
        }
        setLoading(false)
      })
      .catch(err => { setError(`Failed to load match events: ${err.message}`); setLoading(false) })
  }, [selectedMatch])

  // ── Load heatmap data when mode or map changes ───────────────────────────
  useEffect(() => {
    if (!heatmapMode || !selectedMap) { setHeatmapData([]); return }
    const typeMap = {
      kills:   ['Kill', 'BotKill'],
      deaths:  ['Killed', 'BotKilled'],
      storm:   ['KilledByStorm'],
      loot:    ['Loot'],
      traffic: ['Position', 'BotPosition'],
    }
    fetchHeatmapData(selectedMap, typeMap[heatmapMode], selectedDate || null)
      .then(setHeatmapData)
      .catch(err => setError(`Failed to load heatmap: ${err.message}`))
  }, [heatmapMode, selectedMap, selectedDate])

  // ── Playback animation loop ──────────────────────────────────────────────
  const tick = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const elapsed = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp
    // The test data matches are <1s long. We slow playback by 10x so it's watchable over ~10s.
    setTsNow(prev => {
      const next = prev + elapsed * speed * 0.1
      if (next >= tsMax) { setPlaying(false); return tsMax }
      return next
    })
    rafRef.current = requestAnimationFrame(tick)
  }, [speed, tsMax])

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = null
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing, tick])

  const handlePlayPause = () => {
    if (tsNow >= tsMax) setTsNow(tsMin)
    setPlaying(p => !p)
  }

  // ── Match stats (memoised to avoid recomputing on every render) ──────────
  const { killCount, deathCount, lootCount, stormCount } = useMemo(() => {
    let kills = 0, deaths = 0, loot = 0, storm = 0
    for (const e of events) {
      if (e.ts > tsNow) continue
      if (e.event_type === 'Kill' || e.event_type === 'BotKill') kills++
      else if (e.event_type === 'Killed' || e.event_type === 'BotKilled') deaths++
      else if (e.event_type === 'KilledByStorm') storm++
      else if (e.event_type === 'Loot') loot++
    }
    return { killCount: kills, deathCount: deaths, lootCount: loot, stormCount: storm }
  }, [events, tsNow])

  const matchDuration = useMemo(() => {
    if (!events.length) return '0.00s'
    const ms = events[events.length - 1].ts - events[0].ts
    return (ms / 1000).toFixed(2) + 's'
  }, [events])

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-logo">L</div>
        <span className="header-title">LILA BLACK</span>
        <span className="header-subtitle">— Player Journey Visualizer</span>
        {selectedMatch && (
          <div className="header-badge">
            {selectedMatch.map_id} · {selectedMatch.date}
          </div>
        )}
      </header>

      <div className="main-content">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <FilterBar
            maps={maps} dates={dates} matchList={matchList}
            selectedMap={selectedMap} selectedDate={selectedDate} selectedMatch={selectedMatch}
            onMapChange={setSelectedMap} onDateChange={setSelectedDate} onMatchSelect={setSelectedMatch}
            matchesLoading={matchesLoading}
            onOpenMatchSelector={() => setIsMatchModalOpen(true)}
          />

          {selectedMatch && (
            <div className="stats-bar" style={{ margin: '12px 16px', borderRadius: 8 }}>
              <div className="stat-item">
                <span className="stat-label">Kills</span>
                <span className="stat-value" style={{ color: 'var(--accent-kill)' }}>{killCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Deaths</span>
                <span className="stat-value" style={{ color: 'var(--accent-death)' }}>{deathCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Loot</span>
                <span className="stat-value" style={{ color: 'var(--accent-loot)' }}>{lootCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Storm</span>
                <span className="stat-value" style={{ color: 'var(--accent-storm)' }}>{stormCount}</span>
              </div>
            </div>
          )}

          <HeatmapControls heatmapMode={heatmapMode} onModeChange={setHeatmapMode} />
          <LegendPanel />
        </aside>

        {/* ── Map + Timeline ── */}
        <div className="canvas-area">
          <div className="map-viewport">
            {error ? (
              <div className="canvas-placeholder">
                <div className="canvas-placeholder-icon" style={{ fontSize: 32 }}>⚠️</div>
                <p style={{ color: '#f97316', maxWidth: 300, textAlign: 'center' }}>{error}</p>
              </div>
            ) : loading ? (
              <div className="canvas-placeholder">
                <div className="spinner" />
                <p>Loading match data...</p>
              </div>
            ) : !selectedMatch ? (
              <div className="canvas-placeholder">
                <div className="canvas-placeholder-icon">🗺️</div>
                <p>Select a match to begin</p>
              </div>
            ) : (
              <MinimapCanvas
                events={events}
                tsNow={tsNow}
                mapId={selectedMatch.map_id}
                heatmapData={heatmapData}
                heatmapMode={heatmapMode}
              />
            )}
          </div>

          <PlaybackTimeline
            tsMin={tsMin} tsMax={tsMax} tsNow={tsNow}
            playing={playing} speed={speed}
            onPlayPause={handlePlayPause}
            onSeek={setTsNow}
            onSpeedChange={setSpeed}
            disabled={!selectedMatch || events.length === 0}
          />
        </div>
      </div>

      <MatchSelectorModal 
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        matchList={matchList}
        onSelect={setSelectedMatch}
        selectedMatchId={selectedMatch?.match_id}
      />
    </div>
  )
}
