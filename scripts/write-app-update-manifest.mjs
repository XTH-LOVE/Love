import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const manifestPath = path.join(root, 'public', 'app-update.json')
const previous = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {}

const notes = String(process.env.APP_UPDATE_NOTES || '')
  .split('||')
  .map(value => value.trim())
  .filter(Boolean)

const manifest = {
  version: packageJson.version,
  buildId: process.env.NUXT_PUBLIC_APP_BUILD || process.env.GITHUB_SHA || `local-${packageJson.version}`,
  title: previous.title || 'Love小家有新版本了',
  notes: notes.length ? notes : Array.isArray(previous.notes) ? previous.notes : [],
  apkUrl: previous.apkUrl || 'https://love-home.pages.dev/downloads/Love小家-latest.apk',
  desktopUrl: previous.desktopUrl || '',
  webUrl: previous.webUrl || 'https://love-home.pages.dev/',
  publishedAt: process.env.APP_UPDATE_PUBLISHED_AT || new Date().toISOString(),
  mandatory: previous.mandatory === true,
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${path.relative(root, manifestPath)} for ${manifest.version} (${manifest.buildId})`)
