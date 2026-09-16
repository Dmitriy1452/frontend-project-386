import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'
import { client } from '../frontend/src/api/generated/client.gen.ts'
import { ApiError, api } from '../frontend/src/api/client.js'

const NOW = '2026-09-21T09:00:00'
const MONDAY = '2026-09-21'

function weekSchedule() {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals:
        index === 0 ? [{ start: '09:00', end: '12:00' }] : [],
    })),
  })
}

describe('вертикальный срез записи: сгенерированный SDK поверх работающего бэкенда', () => {
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

  it('сквозной путь: слоты → создание записи → подтверждение', async () => {
    const type = await api.createBookingType({
      name: 'Консультация',
      durationMinutes: 30,
    })

    const slots = await api.listSlots(type.id, MONDAY, MONDAY)
    expect(slots[0]).toEqual({
      start: '2026-09-21T09:00:00',
      end: '2026-09-21T09:30:00',
    })

    const booking = await api.createBooking({
      typeId: type.id,
      start: '2026-09-21T10:00:00',
      name: 'Иван',
      email: 'ivan@example.com',
      comment: 'Хочу обсудить проект',
    })
    expect(booking.type).toEqual({
      id: type.id,
      name: 'Консультация',
      durationMinutes: 30,
    })
    expect(booking.status).toBe('active')
  })

  it('гонка через SDK: ровно одна 201, остальные 409', async () => {
    const type = await api.createBookingType({
      name: 'Синк',
      durationMinutes: 30,
    })

    const attempts = Array.from({ length: 5 }, (_, index) =>
      api.createBooking({
        typeId: type.id,
        start: '2026-09-21T11:30:00',
        name: `Гость ${index}`,
        email: `guest${index}@example.com`,
      }),
    )

    const results = await Promise.allSettled(attempts)
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected409 = results.filter(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ApiError &&
        result.reason.status === 409,
    )
    expect(fulfilled).toHaveLength(1)
    expect(rejected409).toHaveLength(4)
    expect(fulfilled[0].value.status).toBe('active')
  })
})