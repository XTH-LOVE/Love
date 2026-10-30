import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')
const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')
const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

describe('public runtime config', () => {
  it('does not expose server credentials through Nuxt public config', () => {
    expect(config).not.toMatch(/turnUrl:|turnUrls:|turnUsername:|turnCredential:|zegoAppSign:/)
    expect(envExample).not.toMatch(/NUXT_PUBLIC_TURN_|NUXT_PUBLIC_ZEGO_APPSIGN/)
    expect(readme).not.toMatch(/NUXT_PUBLIC_TURN_|NUXT_PUBLIC_ZEGO_APPSIGN/)
  })
})
