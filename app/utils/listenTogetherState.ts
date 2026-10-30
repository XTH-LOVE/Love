import type { MusicTrack } from './musicApi'

export function shouldApplyListeningEvent(event: { type: string; revision?: number }, currentRevision: number) {
  if (event.type === 'state' || event.type === 'state-request') return true
  return Number.isFinite(event.revision) && Number(event.revision) > currentRevision
}

export function sameMusicTrack(left: MusicTrack | null | undefined, right: MusicTrack | null | undefined) {
  return Boolean(left && right && left.id === right.id && left.source === right.source)
}

export function estimateListeningPosition(state: { position: number; playing: boolean; sentAt: number }, now = Date.now()) {
  if (!state.playing) return Math.max(0, state.position)
  return Math.max(0, state.position + Math.max(0, now - state.sentAt) / 1000)
}
