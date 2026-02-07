import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabase is optional - app works without it (data won't persist)
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

// Session management - returns mock data if Supabase not configured
export async function createSession(dogId: string, notes: string = '') {
  if (!supabase) {
    // Return mock session for local testing
    return {
      id: `local-${Date.now()}`,
      dog_id: dogId,
      started_at: new Date().toISOString(),
      notes,
      ended_at: null,
      metrics_summary: null
    }
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      dog_id: dogId,
      started_at: new Date().toISOString(),
      notes
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function endSession(sessionId: string, metricsSummary: object) {
  if (!supabase) {
    return {
      id: sessionId,
      ended_at: new Date().toISOString(),
      metrics_summary: metricsSummary
    }
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      metrics_summary: metricsSummary
    })
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveAnalysisResult(
  sessionId: string,
  keypoints: object,
  jointAngles: object,
  gaitMetrics: object
) {
  if (!supabase) {
    return { id: `result-${Date.now()}`, session_id: sessionId }
  }

  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      keypoints_json: keypoints,
      joint_angles: jointAngles,
      gait_metrics: gaitMetrics
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSessionHistory(dogId: string, limit: number = 10) {
  if (!supabase) {
    return [] // No history in local mode
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('dog_id', dogId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getSessionResults(sessionId: string) {
  if (!supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true })

  if (error) throw error
  return data
}
