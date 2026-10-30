import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/033_daily_answer_rls_hardening.sql'), 'utf8')

describe('daily answer RLS migration', () => {
  it('removes legacy permissive policies before defining the hardened policies', () => {
    const legacyDrop = migration.indexOf('drop policy if exists "answers update self"')
    const newPolicy = migration.indexOf('create policy "daily answers update own"')
    expect(legacyDrop).toBeGreaterThanOrEqual(0)
    expect(newPolicy).toBeGreaterThan(legacyDrop)
  })

  it('checks ownership and question-to-couple consistency for writes', () => {
    expect(migration).toContain('user_id = auth.uid()')
    expect(migration).toContain('q.couple_id = daily_answers.couple_id')
    expect(migration.match(/q\.id = daily_answers\.question_id/g)).toHaveLength(4)
  })
})
