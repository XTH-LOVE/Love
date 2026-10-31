import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/036_activity_events.sql'), 'utf8')

describe('couple activity feed migration', () => {
  it('creates a protected realtime activity stream', () => {
    expect(migration).toContain('create table if not exists public.activity_events')
    expect(migration).toContain('public.is_couple_member(couple_id)')
    expect(migration).toContain("alter publication supabase_realtime add table public.activity_events")
  })

  it('covers the shared features that should appear in notifications', () => {
    for (const table of ['messages', 'memories', 'album_photos', 'shared_events', 'together_items', 'anniversaries', 'couple_letters', 'ai_saved_works', 'mood_checkins', 'daily_answers', 'voice_capsules', 'music_room_messages']) {
      expect(migration).toContain(`'${table}'`)
    }
    expect(migration).toContain('create trigger couple_activity_%I')
  })
})
