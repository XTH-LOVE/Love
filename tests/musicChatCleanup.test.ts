import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('music chat upload cleanup', () => {
  it('removes an uploaded voice file when message insertion fails', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/composables/useMusicChat.ts'), 'utf8')
    expect(source).toContain('let uploadedPath =')
    expect(source).toContain('uploadedPath = path')
    expect(source).toContain("storage.from('message-media').remove([uploadedPath])")
  })
})
