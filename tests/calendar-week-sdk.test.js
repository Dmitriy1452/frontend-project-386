import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'
import { client } from '../frontend/src/api/generated/client.gen.ts'
import { api } from '../frontend/src/api/client.js'

const NOW = '2026-09-15T09:00:00'
const MONDAY = '2026-09-21'

function weekSchedule() {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: index === 0 ? [{ start: '09:00', end: '12:00' }] : [],
    })),
  })
}

describe('вертикальный срез календаря владельца: сгенерированный SDK поверх бэкенда', () => {
  const app = buildApp({ schedule: weekSchedule(), now: () => NOW })
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

  it('GET /api/calendar возвращает расписание и записи недели через SDK', async () => {
    const type = await api.createBookingType({
      name: 'Консультация',
      durationMinutes: 30,
    })
    await api.createBooking({
      typeId: type.id,
      start: '2026-09-21T10:00:00',
      name: 'Иван',
      email: 'ivan@example.com',
    })

    const calendar = await api.getCalendarWeek(MONDAY)
    expect(calendar.weekStart).toBe(MONDAY)
    expect(calendar.schedule.days).toHaveLength(7)
    expect(calendar.schedule.days[0].intervals).toEqual([
      { start: '09:00', end: '12:00' },
    ])
    expect(calendar.bookings).toHaveLength(1)
    expect(calendar.bookings[0]).toMatchObject({
      start: '2026-09-21T10:00:00',
      status: 'active',
      name: 'Иван',
    })
    expect(calendar.bookings[0].type).toMatchObject({
      name: 'Консультация',
      durationMinutes: 30,
    })
  })
})