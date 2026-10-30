import { describe, expect, it } from 'vitest'
import { migratePlaylist, rememberRecentTrack } from '../app/utils/listenTogetherPlaylist'
import type { MusicTrack } from '../app/utils/musicApi'

const track = (id: string, source: MusicTrack['source'] = 'netease'): MusicTrack => ({
  id,
  name: id,
  artist: ['artist'],
  album: '',
  picId: '',
  urlId: id,
  lyricId: id,
  source,
})

describe('listen together playlist persistence', () => {
  it('keeps the couple playlist when it already has tracks', () => {
    const couple = [track('couple')]
    expect(migratePlaylist(couple, [track('local')])).toEqual(couple)
  })

  it('migrates local tracks when the couple playlist is empty', () => {
    const local = [track('local')]
    expect(migratePlaylist([], local)).toEqual(local)
  })

  it('deduplicates recent tracks by source and id and caps the list', () => {
    const existing = [track('a'), track('b')]
    const next = rememberRecentTrack(existing, track('a'), 2)
    expect(next.map(item => item.id)).toEqual(['a', 'b'])
    expect(rememberRecentTrack(next, track('c'), 2).map(item => item.id)).toEqual(['c', 'a'])
  })
})
