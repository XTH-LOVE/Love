const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const files = [
  resolve('node_modules/@lucide/vue/dist/esm/Icon.mjs'),
  resolve('node_modules/@lucide/vue/dist/cjs/lucide-vue.js'),
]
const vulnerablePatterns = [
  '} = useLucideProps();',
  '} = useLucideProps() ?? {};',
]
const fixed = '} = {};'

for (const file of files) {
  if (!existsSync(file)) continue
  const source = readFileSync(file, 'utf8')
  if (source.includes(fixed)) continue
  const vulnerable = vulnerablePatterns.find(pattern => source.includes(pattern))
  if (!vulnerable) {
    throw new Error(`Unable to patch Lucide context in ${file}`)
  }
  writeFileSync(file, source.replace(vulnerable, fixed))
}
