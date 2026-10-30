import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('account recovery security', () => {
  it('atomically deletes the matching recovery credential before password reset', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/032_account_recovery_codes.sql'), 'utf8')
    const functionSource = readFileSync(resolve(process.cwd(), 'supabase/functions/account-auth/index.ts'), 'utf8')
    expect(migration).toContain('delete from public.account_recovery_codes recovery')
    expect(migration).toContain('and recovery.recovery_hash = p_recovery_hash')
    expect(migration).toContain('grant execute on function public.consume_account_recovery(text, text) to service_role')
    expect(functionSource).toContain("admin.rpc('consume_account_recovery'")
    expect(functionSource).toContain('admin.auth.admin.updateUserById(String(targetId), { password })')
  })
})
