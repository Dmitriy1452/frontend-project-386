import { describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createBookingTypesStore } from '../backend/src/domain/bookingTypes.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'

const NOW = '2026-09-21T09:00:00'
const MONDAY = '2026-09-21'

function weekSchedule() {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals:
        index === 0
          ? [{ start: '09:00', end: '12:00' }]
          : index === 1
            ? [{ start: '14:00', end: '16:00' }]
            : [],
    })),
  })
}

function makeApp({ schedule, bookingTypes, now } = {}) {
  const types = bookingTypes ?? createBookingTypesStore()
  return buildApp({
    schedule: schedule ?? weekSchedule(),
    bookingTypes: types,
    now: now ?? (() => NOW),
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

async function seedBooking(app, { typeId, start, name = 'Иван', email = 'ivan@example.com', comment }) {
  const payload = { typeId, start, name, email }
  if (comment !== undefined) {
    payload.comment = comment
  }
  return app.inject({ method: 'POST', url: '/api/bookings', payload })
}

describe('свободные слоты: контракт (buildApp + inject)', () => {
  it('GET /api/types/:typeId/slots возвращает слоты шагом 15 минут', async () => {
    const app = makeApp()
    const type = await seedType(app)
    const response = await app.inject({
      method: 'GET',
      url: `/api/types/${type.id}/slots?from=${MONDAY}&to=${MONDAY}`,
    })
    expect(response.statusCode).toBe(200)
    const slots = response.json()
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0]).toEqual({
      start: '2026-09-21T09:00:00',
      end: '2026-09-21T09:30:00',
    })
    for (const slot of slots) {
      expect(slot.start).toMatch(/:\d{2}:00$/)
      expect(slot.start).toBe(slot.start.replace(/:(\d{2}):00$/, ':$1:00'))
    }
    await app.close()
  })

  it('записанный слот исчезает из свободных', async () => {
    const app = makeApp()
    const type = await seedType(app)
    await seedBooking(app, { typeId: type.id, start: '2026-09-21T09:00:00' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/types/${type.id}/slots?from=${MONDAY}&to=${MONDAY}`,
    })
    const starts = response.json().map((slot) => slot.start)
    expect(starts).not.toContain('2026-09-21T09:00:00')
    expect(starts).not.toContain('2026-09-21T09:15:00')
    expect(starts).toContain('2026-09-21T09:30:00')
    await app.close()
  })

  it('ошибка 400 на невалидные диапазоны и неизвестный тип', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const cases = [
      `/api/types/${type.id}/slots?from=not-a-date&to=${MONDAY}`,
      `/api/types/${type.id}/slots?from=${MONDAY}&to=not-a-date`,
      `/api/types/${type.id}/slots?from=2026-09-30&to=2026-09-20`,
      '/api/types/unknown-id/slots?from=2026-09-21&to=2026-09-21',
    ]
    for (const url of cases) {
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode, url).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })
})

describe('создание записи: контракт', () => {
  it('POST /api/bookings возвращает 201 с полной записью и снимком типа', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const response = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T09:00:00',
      name: 'Иван Петров',
      email: 'ivan@example.com',
      comment: 'Хочу обсудить проект',
    })
    expect(response.statusCode).toBe(201)
    const booking = response.json()
    expect(booking.id).toBeTypeOf('string')
    expect(booking.type).toEqual({
      id: type.id,
      name: 'Консультация',
      durationMinutes: 30,
    })
    expect(booking.start).toBe('2026-09-21T09:00:00')
    expect(booking.end).toBe('2026-09-21T09:30:00')
    expect(booking).toMatchObject({
      name: 'Иван Петров',
      email: 'ivan@example.com',
      comment: 'Хочу обсудить проект',
      status: 'active',
    })
    await app.close()
  })

  it('снимок типа в созданной записи не меняется после правки типа', async () => {
    const app = makeApp()
    const type = await seedType(app)
    const created = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T09:00:00',
    })
    const booking = created.json()

    await app.inject({
      method: 'PUT',
      url: `/api/types/${type.id}`,
      payload: { name: 'Переименован', durationMinutes: 60 },
    })

    const stored = app.bookings.list()
    expect(stored[0].type).toEqual({
      id: type.id,
      name: 'Консультация',
      durationMinutes: 30,
    })
    expect(stored[0].start).toBe(booking.start)
    await app.close()
  })

  it('400 на невалидные данные', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const cases = [
      { typeId: type.id, start: '2026-09-21T09:00:00', name: '   ', email: 'ivan@example.com' },
      { typeId: type.id, start: '2026-09-21T09:00:00', name: 'Иван', email: 'не-email' },
      { typeId: type.id, start: '2026-09-21 09:00', name: 'Иван', email: 'ivan@example.com' },
      { start: '2026-09-21T09:00:00', name: 'Иван', email: 'ivan@example.com' },
      { typeId: type.id, start: '2026-09-21T09:00:00', name: 'Иван' },
      { typeId: 'missing', start: '2026-09-21T09:00:00', name: 'Иван', email: 'ivan@example.com' },
    ]

    for (const payload of cases) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        payload,
      })
      expect(response.statusCode, JSON.stringify(payload)).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })

  it('409 при записи на занятый слот, в том числе другим типом', async () => {
    const app = makeApp()
    const first = await seedType(app, 'Первый', 30)
    const second = await seedType(app, 'Второй', 30)

    const created = await seedBooking(app, {
      typeId: first.id,
      start: '2026-09-21T10:00:00',
    })
    expect(created.statusCode).toBe(201)

    const sameTime = await seedBooking(app, {
      typeId: first.id,
      start: '2026-09-21T10:00:00',
    })
    expect(sameTime.statusCode).toBe(409)
    expect(sameTime.json().message).toMatch(/занято/)

    const overlapping = await seedBooking(app, {
      typeId: first.id,
      start: '2026-09-21T10:15:00',
    })
    expect(overlapping.statusCode).toBe(409)

    const otherType = await seedBooking(app, {
      typeId: second.id,
      start: '2026-09-21T10:00:00',
    })
    expect(otherType.statusCode).toBe(409)
    expect(otherType.json().message).toMatch(/занято/)
    await app.close()
  })

  it('409 при выходе за пределы расписания', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const cases = [
      { start: '2026-09-21T12:30:00', name: 'После закрытия интервала' },
      { start: '2026-09-22T12:00:00', name: 'Вторник до открытия' },
      { start: '2026-09-21T12:15:00', name: 'Хвост вне интервала' },
      { start: '2026-09-21T11:45:00', name: 'Хвост не помещается' },
      { start: '2026-09-23T15:00:00', name: 'Закрытый день' },
    ]
    for (const { start, name } of cases) {
      const response = await seedBooking(app, { typeId: type.id, start, name })
      expect(response.statusCode, start).toBe(409)
      expect(response.json().message).toMatch(/расписан/)
    }
    await app.close()
  })

  it('409 на прошедшее время и за пределами окна в 14 дней', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const past = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T08:30:00',
    })
    expect(past.statusCode).toBe(409)
    expect(past.json().message).toMatch(/прошло/)

    const farFuture = await seedBooking(app, {
      typeId: type.id,
      start: '2026-10-10T09:00:00',
    })
    expect(farFuture.statusCode).toBe(409)
    expect(farFuture.json().message).toMatch(/окна записи/)
    await app.close()
  })

  it('гонка параллельных запросов: ровно одна 201, остальные 409', async () => {
    const app = makeApp()
    const type = await seedType(app)

    const requests = Array.from({ length: 6 }, (_, index) =>
      seedBooking(app, {
        typeId: type.id,
        start: '2026-09-21T11:00:00',
        name: `Гость ${index}`,
        email: `guest${index}@example.com`,
      }),
    )

    const responses = await Promise.all(requests)
    const statuses = responses.map((response) => response.statusCode).sort()
    expect(statuses).toEqual([201, 409, 409, 409, 409, 409])
    const created = responses.find((response) => response.statusCode === 201)
    expect(created.json().status).toBe('active')
    for (const message of responses
      .filter((response) => response.statusCode === 409)
      .map((response) => response.json().message)) {
      expect(message).toMatch(/занято/)
    }

    const active = app.bookings
      .list()
      .filter((booking) => booking.start === '2026-09-21T11:00:00')
    expect(active).toHaveLength(1)
    await app.close()
  })
})