import { h, provide } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Flame, LUCIDE_CONTEXT } from '@lucide/vue'
import { describe, expect, it } from 'vitest'

describe('Lucide icon context', () => {
  it('renders icons when an ancestor provides an undefined context value', async () => {
    const Parent = {
      setup() {
        provide(LUCIDE_CONTEXT, undefined)
        return () => h(Flame, { size: 18 })
      },
    }

    const html = await renderToString(h(Parent))

    expect(html).toContain('<svg')
    expect(html).toContain('width="18"')
    expect(html).toContain('height="18"')
  })

  it('keeps the install patch wired into postinstall', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

    expect(packageJson.scripts.postinstall).toContain('patch-lucide-context.cjs')
  })
})
