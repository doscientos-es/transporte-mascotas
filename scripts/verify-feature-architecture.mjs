import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const featureRoot = path.join(root, 'features')
const requiredLayers = ['application', 'infrastructure', 'ui']
const sourceFile = /\.(?:[cm]?[jt]sx?)$/
const testOrMock = /(?:^|[/\\])(?:mocks|tests)(?:[/\\]|$)|\.(?:test|spec)\.[jt]sx?$/
const importFromTestOrMock = /(?:from\s+|import\s*\()["'][^"']*(?:mocks|tests)[/\\]/

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? filesIn(target) : [target]
    }),
  )
  return nested.flat()
}

const failures = []
for (const directory of ['app', 'features', 'pages', 'shared']) {
  if (!(await exists(path.join(root, directory)))) failures.push(`Falta src/${directory}.`)
}

for (const feature of await readdir(featureRoot, { withFileTypes: true })) {
  if (!feature.isDirectory()) continue
  const featurePath = path.join(featureRoot, feature.name)
  for (const layer of requiredLayers) {
    if (!(await exists(path.join(featurePath, layer)))) {
      failures.push(`La feature ${feature.name} no tiene la capa ${layer}.`)
    }
  }
  if (!(await exists(path.join(featurePath, 'index.ts')))) {
    failures.push(`La feature ${feature.name} no expone un index.ts público.`)
  }
}

for (const file of await filesIn(root)) {
  if (!sourceFile.test(file) || testOrMock.test(file)) continue
  if (importFromTestOrMock.test(await readFile(file, 'utf8'))) {
    failures.push(`${path.relative(root, file)} importa mocks o tests desde código de producción.`)
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `${['Architecture check failed:', ...failures.map((failure) => `- ${failure}`)].join('\n')}\n`,
  )
  process.exit(1)
}

process.stdout.write('Architecture check passed.\n')
