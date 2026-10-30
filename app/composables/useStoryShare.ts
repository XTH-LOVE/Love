export type StoryShare = { token: string; expiresAt: string; revokedAt: string }

function localKey(coupleId: string) { return `couple-space-story-share:${coupleId}` }

export function useStoryShare() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  async function createLink(hours = 72) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    const token = crypto.randomUUID()
    if (!$supabase || demoMode.value) {
      const item: StoryShare = { token, expiresAt, revokedAt: '' }
      localStorage.setItem(localKey(profile.value?.coupleId || 'demo'), JSON.stringify(item))
      return item
    }
    if (!profile.value?.coupleId || !profile.value.id) throw new Error('请先进入情侣空间')
    const { data, error } = await $supabase.from('story_share_links').insert({ token, couple_id: profile.value.coupleId, created_by: profile.value.id, expires_at: expiresAt }).select('token, expires_at, revoked_at').single()
    if (error) throw error
    return { token: String(data.token), expiresAt: String(data.expires_at), revokedAt: String(data.revoked_at || '') }
  }

  async function validate(token: string) {
    if (!token) return false
    if (!$supabase || demoMode.value) {
      const raw = localStorage.getItem(localKey(profile.value?.coupleId || 'demo'))
      const item = raw ? JSON.parse(raw) as StoryShare : null
      return Boolean(item?.token === token && !item.revokedAt && Date.parse(item.expiresAt) > Date.now())
    }
    if (!profile.value?.coupleId) return false
    const { data, error } = await $supabase.from('story_share_links').select('token').eq('token', token).eq('couple_id', profile.value.coupleId).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
    return !error && Boolean(data?.token)
  }

  async function revoke(token: string) {
    if (!token) return
    if (!$supabase || demoMode.value) {
      localStorage.removeItem(localKey(profile.value?.coupleId || 'demo'))
      return
    }
    if (!profile.value?.id) throw new Error('登录状态已失效，请重新登录后再试')
    const { error } = await $supabase
      .from('story_share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token)
      .eq('created_by', profile.value.id)
    if (error) throw error
  }

  return { createLink, validate, revoke }
}
