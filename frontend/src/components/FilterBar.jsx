import React from 'react'

export default function FilterBar({
  maps, dates, matchList,
  selectedMap, selectedDate, selectedMatch,
  onMapChange, onDateChange, onMatchSelect,
  matchesLoading, onOpenMatchSelector
}) {
  return (
    <>
      <div className="sidebar-section">
        <div className="sidebar-label">Filters</div>

        <div className="select-wrapper">
          <label className="select-label">Map</label>
          <select value={selectedMap} onChange={e => onMapChange(e.target.value)}>
            {maps.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="select-arrow">▼</span>
        </div>

        <div className="select-wrapper">
          <label className="select-label">Date</label>
          <select
            value={selectedDate}
            onChange={e => onDateChange(e.target.value)}
            disabled={!selectedMap}
          >
            <option value="">All dates</option>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="select-arrow">▼</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">
          Match Selection
          {!matchesLoading && matchList.length > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 700 }}>
              ({matchList.length} available)
            </span>
          )}
        </div>

        {matchesLoading ? (
          <div className="no-data">Loading matches...</div>
        ) : !selectedMap || !selectedDate ? (
          <div className="no-data">Select a map and date</div>
        ) : matchList.length === 0 ? (
          <div className="no-data">No matches found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={onOpenMatchSelector}
              className="select-match-btn"
            >
              {selectedMatch ? 'Change Match' : 'Browse Matches'}
            </button>
            {selectedMatch && (
              <div className="selected-match-display">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Current Match:</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all' }}>
                  {selectedMatch.match_id}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
