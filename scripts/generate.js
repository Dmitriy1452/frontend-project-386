import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npx', ['tsp', 'compile', 'spec'])
run(process.execPath, ['scripts/generate-sdk.js'])
run(process.execPath, ['scripts/generate-backend.js'])

console.log('Генерация завершена: spec/dist/openapi.json, frontend/src/api/generated, backend/src/gen')
