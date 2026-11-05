import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginsDir = path.join(root, 'plugins')
const urlPattern = /^https:\/\/raw\.githubusercontent\.com\/GUI-for-Cores\/Plugin-Hub\/(?:refs\/heads\/)?main\/(plugins\/.+)$/
const pathPattern = /^( {4})"path": (.*?),\r?\n(?: {4}"hash": ".*?",\r?\n)?/gm
const check = process.argv.includes('--check')

const indexes = (await readdir(pluginsDir)).filter((name) => name.endsWith('.json')).sort()
const errors = []
let changed = 0

for (const name of indexes) {
  const file = path.join(pluginsDir, name)
  const source = await readFile(file, 'utf8')
  const plugins = JSON.parse(source)

  const hashes = []
  for (const plugin of plugins) {
    const match = urlPattern.exec(plugin.url || '')
    if (!match) {
      errors.push(`${name}: ${plugin.id} has an unsupported url: ${plugin.url}`)
      hashes.push(plugin.hash)
      continue
    }
    const content = await readFile(path.join(root, match[1])).catch(() => null)
    if (!content) {
      errors.push(`${name}: ${plugin.id} points to a missing file: ${match[1]}`)
      hashes.push(plugin.hash)
      continue
    }
    const hash = createHash('sha256').update(content).digest('hex')
    if (plugin.hash !== hash) {
      changed++
      if (check) errors.push(`${name}: ${plugin.id} hash is outdated`)
    }
    hashes.push(hash)
  }

  let index = 0
  const output = source.replace(pathPattern, (line, indent, value) => {
    const hash = hashes[index++]
    const eol = line.includes('\r\n') ? '\r\n' : '\n'
    return `${indent}"path": ${value},${eol}` + (hash ? `${indent}"hash": "${hash}",${eol}` : '')
  })

  const expected = plugins.map((plugin, i) => {
    const { hash: _, ...rest } = plugin
    return hashes[i] ? { ...rest, hash: hashes[i] } : rest
  })
  if (index !== plugins.length || !isDeepStrictEqual(JSON.parse(output), expected)) {
    errors.push(`${name}: every entry must have a top-level "path" line with 4-space indentation`)
    continue
  }

  if (!check && output !== source) await writeFile(file, output)
}

if (errors.length) {
  console.error(errors.join('\n'))
  if (check) console.error('Run `node scripts/update-hashes.mjs` to update hashes.')
  process.exit(1)
}

console.log(check ? 'All plugin hashes are up to date.' : `Updated ${changed} plugin hashes in ${indexes.join(', ')}.`)
