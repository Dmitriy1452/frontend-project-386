import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { client } from '../frontend/src/api/generated/client.gen.ts'
import { api } from '../frontend/src/api/client.js'

function closedWeek() {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: [],
    })),
  }
}

describe('вертикальный срез: недельное расписание через сгенерированный SDK', () => {
  const app = buildApp()
  let baseUrl

  beforeAll(async () => {
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address()
    baseUrl = `http://127.0.0.1:${address.port}`
    client.setConfig({ baseUrl })
  })

  afterAll(async () => {
    await app.close()
  })

  it('сохраняет недельное расписание и возвращает его при перезагрузке', async () => {
    const initial = await api.getSchedule()
    expect(initial.days).toHaveLength(7)
    for (const day of initial.days) {
      expect(day.intervals).toEqual([])
    }

    const week = closedWeek()
    week.days[0].intervals = [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ]
    week.days[4].intervals = [{ start: '10:00', end: '18:00' }]

    const saved = await api.putSchedule(week)
    expect(saved.days[0].intervals).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ])
    expect(saved.days[4].intervals).toEqual([
      { start: '10:00', end: '18:00' },
    ])
    expect(saved.days[6].intervals).toEqual([])

    const reloaded = await api.getSchedule()
    expect(reloaded).toEqual(saved)
  })
})