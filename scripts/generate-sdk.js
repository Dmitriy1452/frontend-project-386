import { fileURLToPath } from 'node:url'
import { createClient } from '@hey-api/openapi-ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const spec = new URL('../spec/dist/openapi.json', import.meta.url).pathname

const frontendOut = new URL('../frontend/src/api/generated', import.meta.url).pathname
const backendTypesOut = new URL('../backend/src/gen/types', import.meta.url).pathname

await createClient({
  input: spec,
  output: { path: frontendOut },
  plugins: ['@hey-api/typescript', '@hey-api/client-fetch', '@hey-api/sdk'],
})

await createClient({
  input: spec,
  output: { path: backendTypesOut },
  plugins: ['@hey-api/typescript', 'fastify'],
})

console.log('SDK и типы сгенерированы:', repoRoot)
