import React, { useState, useMemo } from 'react'
import '../index.css'

export default function MatchSelectorModal({ isOpen, onClose, matchList, onSelect, selectedMatchId }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [humanFilter, setHumanFilter] = useState('')
  const [botFilter, setBotFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')

  const filteredMatches = useMemo(() => {
    return matchList.filter(m => {
      const matchIdMatch = !searchTerm || m.match_id.toLowerCase().includes(searchTerm.toLowerCase())
      const humanMatch = humanFilter === '' || m.human_count === parseInt(humanFilter, 10)
      const botMatch = botFilter === '' || m.bot_count === parseInt(botFilter, 10)
      const eventMatch = eventFilter === '' || m.action_events >= parseInt(eventFilter, 10)
      return matchIdMatch && humanMatch && botMatch && eventMatch
    })
  }, [matchList, searchTerm, humanFilter, botFilter, eventFilter])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Select a Match</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-search">
          <input 
            type="text" 
            placeholder="Search by Match ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
            style={{ marginBottom: 12 }}
          />
          <div className="modal-filters" style={{ display: 'flex', gap: 10 }}>
            <input 
              type="number" 
              placeholder="Humans (exact)" 
              value={humanFilter}
              onChange={e => setHumanFilter(e.target.value)}
              className="search-input"
              style={{ flex: 1 }}
              min="0"
            />
            <input 
              type="number" 
              placeholder="Bots (exact)" 
              value={botFilter}
              onChange={e => setBotFilter(e.target.value)}
              className="search-input"
              style={{ flex: 1 }}
              min="0"
            />
            <input 
              type="number" 
              placeholder="Min. Events" 
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="search-input"
              style={{ flex: 1 }}
              min="0"
            />
          </div>
        </div>

        <div className="modal-body">
          <table className="match-table">
            <thead>
              <tr>
                <th aria-label="Unique identifier for the match">Match ID</th>
                <th aria-label="Number of human players in the match">Humans</th>
                <th aria-label="Number of AI bots in the match">Bots</th>
                <th aria-label="Total non-positional action events">Total Events</th>
                <th aria-label="Total loot interaction events">Loot</th>
                <th aria-label="Number of kills by human players">Kill</th>
                <th aria-label="Number of kills by bot players">BotKill</th>
                <th aria-label="Number of human players eliminated">Killed</th>
                <th aria-label="Number of bot players eliminated">BotKilled</th>
                <th aria-label="Number of eliminations caused by the storm or zone">Storm</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.map(match => (
                <tr 
                  key={match.match_id} 
                  className={match.match_id === selectedMatchId ? 'active' : ''}
                  onClick={() => {
                    onSelect(match)
                    onClose()
                  }}
                >
                  <td className="match-id-cell">{match.match_id}</td>
                  <td className="metric-cell" aria-label={`Humans: ${match.human_count}`}><span className="match-chip chip-human">👤 {match.human_count}</span></td>
                  <td className="metric-cell" aria-label={`Bots: ${match.bot_count}`}><span className="match-chip chip-bot">🤖 {match.bot_count}</span></td>
                  <td className="metric-cell" aria-label={`Total Action Events: ${match.action_events}`}><span className="match-chip chip-events">{match.action_events}</span></td>
                  <td className="metric-cell" aria-label={`Loot events: ${match.loot_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-loot)' }}>{match.loot_events}</span></td>
                  <td className="metric-cell" aria-label={`Human kill events: ${match.kill_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-kill)' }}>{match.kill_events}</span></td>
                  <td className="metric-cell" aria-label={`Bot kill events: ${match.botkill_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-kill)' }}>{match.botkill_events}</span></td>
                  <td className="metric-cell" aria-label={`Human death events: ${match.killed_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-death)' }}>{match.killed_events}</span></td>
                  <td className="metric-cell" aria-label={`Bot death events: ${match.botkilled_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-death)' }}>{match.botkilled_events}</span></td>
                  <td className="metric-cell" aria-label={`Storm death events: ${match.storm_events}`}><span className="match-chip chip-events" style={{ color: 'var(--accent-storm)' }}>{match.storm_events}</span></td>
                </tr>
              ))}
              {filteredMatches.length === 0 && (
                <tr>
                  <td colSpan="10" className="no-data">No matches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
