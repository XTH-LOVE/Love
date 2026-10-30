import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeNeteasePlaylist,
  normalizeNeteasePlaylistTrack,
  discoverPlaylists,
  searchPlaylists,
} from '../app/utils/musicApi'
import { tracksAfterSelected } from '../app/utils/listenTogetherPlaylist'

afterEach(() => vi.unstubAllGlobals())

describe('netease playlist normalization', () => {
  it('normalizes playlist metadata and converts cover urls to https', () => {
    expect(normalizeNeteasePlaylist({
      id: 123,
      name: '华语精选',
      coverImgUrl: 'http://p1.music.126.net/cover.jpg',
      description: '适合一起听',
      creator: { nickname: '小屋歌单' },
      trackCount: 42,
      playCount: 120000,
    })).toEqual({
      id: '123',
      name: '华语精选',
      coverUrl: 'https://p1.music.126.net/cover.jpg',
      description: '适合一起听',
      creatorName: '小屋歌单',
      trackCount: 42,
      playCount: 120000,
      source: 'netease',
    })
  })

  it('normalizes both official and GD Studio track field shapes', () => {
    expect(normalizeNeteasePlaylistTrack({
      id: 88,
      name: '晴天',
      ar: [{ name: '周杰伦' }],
      al: { name: '叶惠美', pic: 9988 },
    })).toMatchObject({
      id: '88',
      name: '晴天',
      artist: ['周杰伦'],
      album: '叶惠美',
      picId: '9988',
      urlId: '88',
      lyricId: '88',
      source: 'netease',
    })

    expect(normalizeNeteasePlaylistTrack({
      id: '89',
      name: '稻香',
      artists: [{ name: '周杰伦' }],
      album: { name: '魔杰座', picUrl: 'https://cover.test/a.jpg' },
    })).toMatchObject({
      artist: ['周杰伦'],
      album: '魔杰座',
      picId: '',
      coverUrl: 'https://cover.test/a.jpg',
    })
  })

  it('uses safe defaults and rejects incomplete records', () => {
    expect(normalizeNeteasePlaylist(null)).toBeNull()
    expect(normalizeNeteasePlaylist({ id: 1 } as any)).toBeNull()
    expect(normalizeNeteasePlaylist({
      id: 2,
      name: '空歌单',
      creator: {},
      description: null,
    })).toMatchObject({
      id: '2',
      creatorName: '网易云用户',
      description: '',
      trackCount: 0,
      playCount: 0,
      coverUrl: '',
    })
    expect(normalizeNeteasePlaylistTrack({ id: 1, name: '无歌手' })).toMatchObject({
      artist: [],
      album: '',
      picId: '',
    })
    expect(normalizeNeteasePlaylistTrack({ name: '缺少 ID' } as any)).toBeNull()
  })
})

describe('playlist playback queue', () => {
  const track = (id: string, source: 'netease' | 'joox' = 'netease') => ({
    id,
    name: id,
    artist: [],
    album: '',
    picId: '',
    urlId: id,
    lyricId: id,
    source,
  })

  it('queues only tracks after the selected playlist item', () => {
    const tracks = [track('a'), track('b'), track('c'), track('d')]
    expect(tracksAfterSelected(tracks, tracks[1])).toEqual([tracks[2], tracks[3]])
  })

  it('does not accidentally match the same id from another source', () => {
    const tracks = [track('same', 'netease'), track('same', 'joox'), track('last', 'joox')]
    expect(tracksAfterSelected(tracks, tracks[1])).toEqual([tracks[2]])
  })
})

describe('netease playlist API requests', () => {
  it('passes keyword, page and count to the server proxy', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('action=search')
      expect(url).toContain('q=%E5%91%A8%E6%9D%B0%E4%BC%A6')
      expect(url).toContain('page=2')
      expect(url).toContain('count=18')
      return {
        ok: true,
        json: async () => ({
          result: {
            playlists: [{ id: 7, name: '测试歌单', trackCount: 1, playCount: 2 }],
          },
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const items = await searchPlaylists('周杰伦', 2, 18)
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('7')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads public discovery playlists by category and page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('action=discover')
      expect(url).toContain('category=%E8%BD%BB%E9%9F%B3%E4%B9%90')
      expect(url).toContain('page=3')
      expect(url).toContain('count=20')
      return {
        ok: true,
        json: async () => ({ playlists: [{ id: 9, name: '轻音乐歌单' }] }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const items = await discoverPlaylists('轻音乐', 3, 20)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('轻音乐歌单')
  })
})
