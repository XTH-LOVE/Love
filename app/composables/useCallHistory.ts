export type CallRecord = {
  id: string
  callId: string
  callerId: string
  mode: 'audio' | 'video'
  status: 'calling' | 'connected' | 'completed' | 'cancelled' | 'declined'
  startedAt: string
  answeredAt: string | null
  endedAt: string | null
  durationSeconds: number
}

const callRecords = ref<CallRecord[]>([])
const callHistoryLoading = ref(false)
let callHistoryChannel: any = null
let callHistoryUnavailable = false

function isMissingCallHistoryTable(error: any) {
  const status = Number(error?.status || error?.statusCode || 0)
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || status === 404 || message.includes('call_records') || message.includes('relation') && message.includes('does not exist')
}

function markCallHistoryUnavailable(error: any) {
  if (!isMissingCallHistoryTable(error)) return false
  callHistoryUnavailable = true
  callRecords.value = []
  return true
}

function mapRecord(row: any): CallRecord {
  return {
    id: String(row.id), callId: String(row.call_id), callerId: String(row.caller_id),
    mode: row.call_mode === 'video' ? 'video' : 'audio', status: row.status,
    startedAt: row.started_at, answeredAt: row.answered_at || null, endedAt: row.ended_at || null,
    durationSeconds: Number(row.duration_seconds || 0),
  }
}

function upsertRecord(record: CallRecord) {
  const existing = callRecords.value.findIndex(item => item.id === record.id)
  const next = existing >= 0 ? callRecords.value.map(item => item.id === record.id ? record : item) : [record, ...callRecords.value]
  callRecords.value = next.sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
}

export function useCallHistory() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function loadCallHistory() {
    if (!$supabase || demoMode.value || !profile.value?.coupleId || callHistoryUnavailable) { callRecords.value = []; return }
    callHistoryLoading.value = true
    try {
      const { data, error } = await $supabase.from('call_records').select('*').eq('couple_id', profile.value.coupleId).order('started_at', { ascending: false }).limit(80)
      if (error) {
        if (markCallHistoryUnavailable(error)) return
        throw error
      }
      callRecords.value = (data || []).map(mapRecord)
    } finally { callHistoryLoading.value = false }
  }

  async function subscribeCallHistory() {
    if (!$supabase || demoMode.value || callHistoryUnavailable || callHistoryChannel || !profile.value?.coupleId) return
    callHistoryChannel = $supabase.channel(`call-history:${profile.value.coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_records', filter: `couple_id=eq.${profile.value.coupleId}` }, ({ eventType, new: row, old }: any) => {
        if (eventType === 'DELETE') callRecords.value = callRecords.value.filter(item => item.id !== old.id)
        else upsertRecord(mapRecord(row))
      })
      .subscribe()
  }

  async function disconnectCallHistory() {
    if (callHistoryChannel && $supabase) await $supabase.removeChannel(callHistoryChannel)
    callHistoryChannel = null
    callRecords.value = []
  }

  async function createCallRecord(callId: string, mode: 'audio' | 'video') {
    if (!$supabase || demoMode.value || callHistoryUnavailable || !profile.value?.coupleId || !profile.value.id) return
    const { data, error } = await $supabase.from('call_records').insert({ call_id: callId, couple_id: profile.value.coupleId, caller_id: profile.value.id, call_mode: mode }).select('*').single()
    if (error) { if (markCallHistoryUnavailable(error)) return; throw error }
    if (data) upsertRecord(mapRecord(data))
  }

  async function markCallConnected(callId: string) {
    if (!$supabase || demoMode.value || callHistoryUnavailable || !profile.value?.id) return
    const answeredAt = new Date().toISOString()
    const { data, error } = await $supabase.from('call_records').update({ status: 'connected', answered_at: answeredAt }).eq('call_id', callId).eq('caller_id', profile.value.id).select('*').maybeSingle()
    if (error) { if (markCallHistoryUnavailable(error)) return; throw error }
    if (data) upsertRecord(mapRecord(data))
  }

  async function finishCallRecord(callId: string, connectedAt: number | null, status: 'completed' | 'cancelled' | 'declined') {
    if (!$supabase || demoMode.value || callHistoryUnavailable || !profile.value?.id || !callId) return
    const endedAt = new Date().toISOString()
    const durationSeconds = connectedAt ? Math.max(0, Math.round((Date.now() - connectedAt) / 1000)) : 0
    const { data, error } = await $supabase.from('call_records').update({ status, ended_at: endedAt, duration_seconds: durationSeconds }).eq('call_id', callId).eq('caller_id', profile.value.id).select('*').maybeSingle()
    if (error) { if (markCallHistoryUnavailable(error)) return; throw error }
    if (data) upsertRecord(mapRecord(data))
  }

  return { callRecords, callHistoryLoading, loadCallHistory, subscribeCallHistory, disconnectCallHistory, createCallRecord, markCallConnected, finishCallRecord }
}
