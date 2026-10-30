import { clearCachedMedia, createMediaSignedUrl } from './useMediaUrls'

export type MemberProfile = { id: string; displayName: string; avatarUrl: string; email?: string }
type ProfileRow = { id: string; display_name: string; avatar_url: string | null }

const members = ref<MemberProfile[]>([])
const accountLoading = ref(false)
let memberChannel: any = null

export function useAccountManagement() {
const { $supabase } = useNuxtApp()
const { profile, demoMode } = useCoupleAuth()

async function signedAvatar(path: string) {
  if (!path) return ''
  return createMediaSignedUrl($supabase, path, 'avatars', { width: 160, height: 160, resize: 'cover', quality: 78 }, 3600)
}

async function toMember(row: ProfileRow): Promise<MemberProfile> {
  return { id: row.id, displayName: row.display_name, avatarUrl: await signedAvatar(row.avatar_url || '') }
}

async function loadMembers() {
  if (!$supabase || demoMode.value) {
    members.value = [{ id: profile.value?.id || 'demo-user', displayName: profile.value?.displayName || '我', avatarUrl: '' }, { id: 'demo-partner', displayName: profile.value?.partnerName || '等待伴侣加入', avatarUrl: '' }]
    return
  }
  accountLoading.value = true
  try {
    const { data, error } = await $supabase.rpc('get_couple_profiles')
    if (error) throw error
    members.value = await Promise.all((data || []).map((row: any) => toMember({ id: row.user_id, display_name: row.display_name, avatar_url: row.avatar_url })))
  } finally { accountLoading.value = false }
}

async function applyProfileUpdate(row: ProfileRow) {
  if (!row?.id || !members.value.some(member => member.id === row.id)) return
  const updated = await toMember(row)
  members.value = members.value.map(member => member.id === updated.id ? updated : member)
  if (updated.id === profile.value?.id && profile.value) profile.value.displayName = updated.displayName
}

async function subscribeMembers() {
  if (!$supabase || demoMode.value || memberChannel || !profile.value?.coupleId) return
  memberChannel = $supabase.channel(`members:${profile.value.coupleId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, ({ payload }: any) => { void applyProfileUpdate(payload.new as ProfileRow) })
    .subscribe()
}
async function disconnectMembers() {
  if (memberChannel && $supabase) await $supabase.removeChannel(memberChannel)
  memberChannel = null
  members.value = []
}
async function updateName(name:string){if(!$supabase||demoMode.value){if(profile.value)profile.value.displayName=name;await loadMembers();return}const{error}=await $supabase.from('profiles').update({display_name:name}).eq('id',profile.value!.id);if(error)throw error;if(profile.value)profile.value.displayName=name;await loadMembers()}
async function uploadAvatar(file:File){if(!$supabase||demoMode.value)return URL.createObjectURL(file);const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';const path=`${profile.value!.id}/avatar-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const{error}=await $supabase.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const{error:updateError}=await $supabase.from('profiles').update({avatar_url:path}).eq('id',profile.value!.id);if(updateError)throw updateError;await clearCachedMedia();await loadMembers();return members.value.find(x=>x.id===profile.value!.id)?.avatarUrl||''}
async function regenerateInvitation(){if(!$supabase||demoMode.value)return'LOVE-7286';const{data,error}=await $supabase.rpc('regenerate_couple_invitation');if(error)throw error;return data as string}
async function unlinkCouple(){if(!$supabase||demoMode.value)return;const{error}=await $supabase.rpc('leave_couple_space');if(error)throw error}
async function updateRelationshipStart(value:string){if(!value)throw new Error('请选择在一起的日期');if(value>new Date().toISOString().slice(0,10))throw new Error('在一起的日期不能晚于今天');if(!$supabase||demoMode.value){localStorage.setItem('couple-space-start',value);return}const{error}=await $supabase.from('couples').update({relationship_start:value}).eq('id',profile.value!.coupleId);if(error)throw error}
return{members,accountLoading,loadMembers,subscribeMembers,disconnectMembers,updateName,updateRelationshipStart,uploadAvatar,regenerateInvitation,unlinkCouple}}
