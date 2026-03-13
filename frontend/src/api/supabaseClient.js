import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Matches ──────────────────────────────────────────────────────────────────

export async function fetchMaps() {
  const { data, error } = await supabase
    .from('matches')
    .select('map_id')
    .order('map_id')
  if (error) throw error
  return [...new Set(data.map(r => r.map_id))].sort()
}

export async function fetchDates(mapId) {
  const { data, error } = await supabase
    .from('matches')
    .select('date')
    .eq('map_id', mapId)
    .order('date')
  if (error) throw error
  return [...new Set(data.map(r => r.date))].sort()
}

export async function fetchMatches(mapId, date) {
  let query = supabase
    .from('matches')
    .select('match_id, map_id, date, human_count, bot_count, total_events')
    .order('total_events', { ascending: false })
  if (mapId) query = query.eq('map_id', mapId)
  if (date)  query = query.eq('date', date)
  const { data: matches, error } = await query
  if (error) throw error
  if (!matches || matches.length === 0) return []

  // Fetch all non-movement events for this map and date to aggregate custom event types.
  // We use pagination just in case, though it is a small subset of the total rows.
  const PAGE_SIZE = 1000
  let allEvents = []
  let from = 0
  let hasMore = true
  
  while (hasMore) {
    let evQuery = supabase.from('events').select('match_id, event_type')
      .not('event_type', 'in', '("Position","BotPosition")')
      .range(from, from + PAGE_SIZE - 1)
      
    if (mapId) evQuery = evQuery.eq('map_id', mapId)
    if (date) evQuery = evQuery.eq('date', date)

    const { data: evs, error: evErr } = await evQuery
    if (evErr) throw evErr
    allEvents = allEvents.concat(evs)
    hasMore = evs.length === PAGE_SIZE
    from += PAGE_SIZE
  }

  // Initialize count buckets for each match
  const countsByMatch = {}
  for (const m of matches) {
     countsByMatch[m.match_id] = { loot: 0, kill: 0, botkill: 0, killed: 0, botkilled: 0, storm: 0, action_events: 0 }
  }
  
  for (const ev of allEvents) {
    if (!countsByMatch[ev.match_id]) continue
    const c = countsByMatch[ev.match_id]
    c.action_events++
    if (ev.event_type === 'Loot') c.loot++
    else if (ev.event_type === 'Kill') c.kill++
    else if (ev.event_type === 'BotKill') c.botkill++
    else if (ev.event_type === 'Killed') c.killed++
    else if (ev.event_type === 'BotKilled') c.botkilled++
    else if (ev.event_type === 'KilledByStorm') c.storm++
  }

  // Merge the aggregated counts back into the match array
  return matches.map(m => ({
    ...m,
    loot_events: countsByMatch[m.match_id].loot,
    kill_events: countsByMatch[m.match_id].kill,
    botkill_events: countsByMatch[m.match_id].botkill,
    killed_events: countsByMatch[m.match_id].killed,
    botkilled_events: countsByMatch[m.match_id].botkilled,
    storm_events: countsByMatch[m.match_id].storm,
    action_events: countsByMatch[m.match_id].action_events,
  }))
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function fetchMatchEvents(matchId) {
  // Supabase has a default 1000-row limit. We paginate to get ALL events for a match.
  const PAGE_SIZE = 1000
  let allData = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('events')
      .select('user_id, map_id, px, py, ts, event_type, is_bot')
      .eq('match_id', matchId)
      .order('ts', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    allData = allData.concat(data)
    hasMore = data.length === PAGE_SIZE
    from += PAGE_SIZE
  }

  return allData
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

export async function fetchHeatmapData(mapId, eventTypes, date = null) {
  let query = supabase
    .from('events')
    .select('px, py')
    .eq('map_id', mapId)
    .in('event_type', eventTypes)
  if (date) query = query.eq('date', date)
  const { data, error } = await query
  if (error) throw error
  return data
}
