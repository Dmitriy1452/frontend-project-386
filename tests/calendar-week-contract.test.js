import { describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createBookingTypesStore } from '../backend/src/domain/bookingTypes.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'

const NOW = '2026-09-15T09:00:00'
const MONDAY = '2026-09-21'
const SUNDAY = '2026-09-27'

function openWeek() {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: [1, 7].includes(index + 1)
        ? [{ start: '09:00', end: '12:00' }]
        : [],
    })),
  })
}

function makeApp() {
  return buildApp({
    schedule: openWeek(),
    bookingTypes: createBookingTypesStore(),
    now: () => NOW,
  })
}

async function seedType(app, name = 'Консультация', durationMinutes = 30) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/types',
    payload: { name, durationMinutes },
  })
  return response.json()
}

async function seedBooking(
  app,
  { typeId, start, name = 'Иван', email = 'ivan@example.com' },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/bookings',
    payload: { typeId, start, name, email },
  })
  return response.json()
}

describe('недельный календарь владельца: контракт (buildApp + inject)', () => {
  it('GET /api/calendar возвращает расписание и записи недели', async () => {
    const app = makeApp()
    const type = await seedType(app)
    await seedBooking(app, { typeId: type.id, start: '2026-09-21T10:00:00' })
    await seedBooking(app, { typeId: type.id, start: '2026-09-27T09:00:00' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/calendar?weekStart=${MONDAY}`,
    })
    expect(response.statusCode).toBe(200)
    const calendar = response.json()
    expect(calendar.weekStart).toBe(MONDAY)
    expect(calendar.schedule).toEqual({
      days: Array.from({ length: 7 }, (_, index) => ({
        dayOfWeek: index + 1,
        intervals:
          [1, 7].includes(index + 1) ? [{ start: '09:00', end: '12:00' }] : [],
      })),
    })
    expect(calendar.bookings.map((booking) => booking.start)).toEqual([
      '2026-09-21T10:00:00',
      '2026-09-27T09:00:00',
    ])
    await app.close()
  })

  it('срез недели включает только записи внутри недели понедельник–воскресенье', async () => {
    const app = makeApp()
    const type = await seedType(app)
    await seedBooking(app, { typeId: type.id, start: '2026-09-20T10:00:00' })
    await seedBooking(app, { typeId: type.id, start: '2026-09-21T10:00:00' })
    await seedBooking(app, { typeId: type.id, start: '2026-09-28T09:00:00' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/calendar?weekStart=${MONDAY}`,
    })
    expect(response.statusCode).toBe(200)
    const starts = response.json().bookings.map((booking) => booking.start)
    expect(starts).toEqual(['2026-09-21T10:00:00'])
    await app.close()
  })

  it('изменение расписания не отменяет активные записи и отражается в срезе', async () => {
    const app = makeApp()
    const type = await seedType(app)
    const booking = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T10:00:00',
    })

    const closedMonday = openWeek().get()
    closedMonday.days[0].intervals = []
    const put = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: closedMonday,
    })
    expect(put.statusCode).toBe(200)

    const response = await app.inject({
      method: 'GET',
      url: `/api/calendar?weekStart=${MONDAY}`,
    })
    expect(response.statusCode).toBe(200)
    const calendar = response.json()
    expect(calendar.schedule.days[0].intervals).toEqual([])
    const stillThere = calendar.bookings.find(
      (item) => item.id === booking.id,
    )
    expect(stillThere).toBeTruthy()
    expect(stillThere.status).toBe('active')
    await app.close()
  })

  it('отменённая запись остаётся в срезе недели со статусом cancelled', async () => {
    const app = makeApp()
    const type = await seedType(app)
    const booking = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T11:00:00',
    })

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/bookings/${booking.id}/cancel`,
    })
    expect(cancel.statusCode).toBe(200)

    const response = await app.inject({
      method: 'GET',
      url: `/api/calendar?weekStart=${MONDAY}`,
    })
    expect(response.statusCode).toBe(200)
    const calendar = response.json()
    const cancelled = calendar.bookings.find((item) => item.id === booking.id)
    expect(cancelled).toBeTruthy()
    expect(cancelled.status).toBe('cancelled')
    await app.close()
  })

  it('400 на невалидную или отсутствующую weekStart', async () => {
    const app = makeApp()
    const cases = [
      '/api/calendar',
      '/api/calendar?weekStart=not-a-date',
      '/api/calendar?weekStart=2026-13-01',
      '/api/calendar?weekStart=2026-09-21T09:00:00',
    ]
    for (const url of cases) {
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode, url).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })

  it('срез недели отдаётся в наивном локальном времени владельца без смещения', async () => {
    const app = makeApp()
    const type = await seedType(app)
    await seedBooking(app, {
      typeId: type.id,
      start: `${SUNDAY}T09:00:00`,
      name: 'Анна',
      email: 'anna@example.com',
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/calendar?weekStart=${MONDAY}`,
    })
    const { bookings } = response.json()
    expect(bookings[0]).toMatchObject({
      start: '2026-09-27T09:00:00',
      end: '2026-09-27T09:30:00',
      name: 'Анна',
      email: 'anna@example.com',
      status: 'active',
    })
    expect(bookings[0].type).toMatchObject({ name: 'Консультация', durationMinutes: 30 })
    await app.close()
  })
})