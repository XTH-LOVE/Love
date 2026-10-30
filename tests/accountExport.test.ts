import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'app/composables/useAccountSecurity.ts'), 'utf8')

describe('account export', () => {
  it('uses paged reads and includes the newer shared-space modules', () => {
    expect(source).toContain('.range(offset, offset + pageSize - 1)')
    for (const table of ['mood_checkins', 'daily_questions', 'daily_answers', 'shared_events', 'music_room_messages', 'listening_sessions', 'voice_capsules']) {
      expect(source).toContain(`fetchOptionalPaged('${table}'`)
    }
    expect(source).toContain("fetchPagedRpc('get_future_letters')")
  })

  it('exports posters and audio media paths', () => {
    expect(source).toContain('item.media_poster_path')
    expect(source).toContain('item.audio_path')
    expect(source).toContain('item.video_poster_path')
  })
})
