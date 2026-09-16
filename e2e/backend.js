import { buildApp } from '../backend/app.js'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function localDate(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

const NOW = `${localDate()}T10:00:00`
const app = buildApp({ now: NOW })

app.listen({ host: '127.0.0.1', port: 3000 }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})

function shutdown() {
  app.close().finally(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
