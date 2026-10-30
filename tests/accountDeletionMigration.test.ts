import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/030_account_deletion_integrity.sql'), 'utf8')

describe('account deletion migration', () => {
  it('limits sender reassignment to the authenticated account-deletion transaction', () => {
    expect(migration).toContain("current_setting('app.account_deletion', true) is distinct from 'on'")
    expect(migration).toContain('old.sender_id is distinct from auth.uid()')
    expect(migration).toContain('public.is_couple_member(old.couple_id, new.sender_id)')
  })

  it('reassigns foreign-key-owned shared data before deleting the profile', () => {
    expect(migration).toContain('update public.messages set sender_id = partner_id')
    expect(migration).toContain('update public.music_room_messages set sender_id = partner_id')
    expect(migration).toContain('update public.couple_easter_eggs set created_by = partner_id')
    expect(migration).toContain('update public.listening_sessions set updated_by = partner_id')
    expect(migration.lastIndexOf('delete from public.profiles where id = current_user_id')).toBeGreaterThan(migration.indexOf('update public.listening_sessions'))
  })
})
