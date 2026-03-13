import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase.from('events').select('ts, match_id, user_id').limit(5)
  if (error) console.error(error)
  console.log(data)
  
  // also get min and max for a specific match
  if (data && data.length > 0) {
    const matchId = data[0].match_id
    const { data: mdata } = await supabase.from('events').select('ts').eq('match_id', matchId)
    const min = Math.min(...mdata.map(d => d.ts))
    const max = Math.max(...mdata.map(d => d.ts))
    console.log(`Match ${matchId} min: ${min}, max: ${max}, duration: ${max - min}`)
  }
}
main()
