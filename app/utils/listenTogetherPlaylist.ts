import type { MusicTrack } from '~/utils/musicApi'

export function migratePlaylist(coupleTracks: MusicTrack[], localTracks: MusicTrack[]) {
  return coupleTracks.length ? coupleTracks : localTracks
}

export function rememberRecentTrack(existing: MusicTrack[], track: MusicTrack, limit = 12) {
  const next = [track, ...existing.filter(item => !(item.source === track.source && item.id === track.id))]
  return next.slice(0, Math.max(1, limit))
}

export function tracksAfterSelected(tracks: MusicTrack[], selected: MusicTrack) {
  const index = tracks.findIndex(track => track.source === selected.source && track.id === selected.id)
  return index < 0 ? [] : tracks.slice(index + 1)
}
