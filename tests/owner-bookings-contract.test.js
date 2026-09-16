import { describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createBookingTypesStore } from '../backend/src/domain/bookingTypes.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'

const REFERENCE_NOW = '2026-09-21T09:00:00'
const PAST_NOW = '2026-09-14T09:00:00'
const MONDAY = '2026-09-21'

function openWeek() {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: [1, 3].includes(index + 1)
        ? [{ start: '09:00', end: '12:00' }]
        : [],
    })),
  })
}

function makeApp() {
  let nowValue = PAST_NOW
  const app = buildApp({
    schedule: openWeek(),
    bookingTypes: createBookingTypesStore(),
    now: () => nowValue,
  })
  return {
    app,
    setNow: (value) => {
      nowValue = value
    },
  }
}

async function seedType(app, name = 'Консультация', durationMinutes = 30) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/types',
    payload: { name, durationMinutes },
  })
  return response.json()
}

async function seedBooking(app, { typeId, start, name, email, comment }) {
  const payload = { typeId, start, name, email }
  if (comment !== undefined) {
    payload.comment = comment
  }
  return app.inject({ method: 'POST', url: '/api/bookings', payload })
}

async function seedPast(app, typeId) {
  await seedBooking(app, {
    typeId,
    start: '2026-09-14T11:00:00',
    name: 'Ирина',
    email: 'irina@example.com',
    comment: 'Обсудим план',
  })
  await seedBooking(app, {
    typeId,
    start: '2026-09-16T09:00:00',
    name: 'Пётр',
    email: 'petr@example.com',
  })
  await seedBooking(app, {
    typeId,
    start: '2026-09-16T10:00:00',
    name: 'Анна',
    email: 'anna@example.com',
    comment: 'Вопрос по проекту',
  })
}

async function seedFuture(app, typeId) {
  await seedBooking(app, {
    typeId,
    start: '2026-09-21T09:00:00',
    name: 'Максим',
    email: 'maksim@example.com',
  })
  await seedBooking(app, {
    typeId,
    start: '2026-09-21T11:00:00',
    name: 'Ольга',
    email: 'olga@example.com',
    comment: 'Хочу обсудить условия',
  })
  await seedBooking(app, {
    typeId,
    start: '2026-09-23T09:00:00',
    name: 'Дмитрий',
    email: 'dmitriy@example.com',
  })
}

async function withSeededBookings() {
  const { app, setNow } = makeApp()
  const type = await seedType(app)
  await seedPast(app, type.id)
  setNow(REFERENCE_NOW)
  await seedFuture(app, type.id)
  return { app, setNow, type }
}

describe('список звонков владельца: контракт (buildApp + inject)', () => {
  it('GET /api/bookings?scope=future возвращает будущие по возрастанию с деталями', async () => {
    const { app } = await withSeededBookings()

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?scope=future',
    })
    expect(response.statusCode).toBe(200)
    const page = response.json()
    expect(page.items.map((item) => item.start)).toEqual([
      '2026-09-21T09:00:00',
      '2026-09-21T11:00:00',
      '2026-09-23T09:00:00',
    ])
    expect(page.nextCursor).toBeUndefined()
    for (const item of page.items) {
      expect(item.end).toBeTypeOf('string')
      expect(item.type.name).toBeTypeOf('string')
      expect(item.name).toBeTypeOf('string')
      expect(item.email).toBeTypeOf('string')
      expect(item.status).toBe('active')
    }
    expect(page.items[0].comment).toBeUndefined()
    expect(page.items[1].comment).toBe('Хочу обсудить условия')
    await app.close()
  })

  it('GET /api/bookings?scope=past возвращает прошедшие по убыванию', async () => {
    const { app } = await withSeededBookings()

    const response = await app.inject({
      method: 'GET',
      url: '/api/bookings?scope=past',
    })
    expect(response.statusCode).toBe(200)
    const page = response.json()
    expect(page.items.map((item) => item.start)).toEqual([
      '2026-09-16T10:00:00',
      '2026-09-16T09:00:00',
      '2026-09-14T11:00:00',
    ])
    await app.close()
  })

  it('отменённые записи остаются в своей временной группе', async () => {
    const { app } = await withSeededBookings()
    const list = await app.inject({ method: 'GET', url: '/api/bookings?scope=future' })
    const futureBooking = list.json().items.find((item) => item.start === '2026-09-21T11:00:00')

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/bookings/${futureBooking.id}/cancel`,
    })
    expect(cancel.statusCode).toBe(200)
    expect(cancel.json().status).toBe('cancelled')

    const after = await app.inject({ method: 'GET', url: '/api/bookings?scope=future' })
    const starts = after.json().items.map((item) => item.start)
    expect(starts).toEqual([
      '2026-09-21T09:00:00',
      '2026-09-21T11:00:00',
      '2026-09-23T09:00:00',
    ])
    const updated = after.json().items.find((item) => item.id === futureBooking.id)
    expect(updated.status).toBe('cancelled')
    await app.close()
  })

  it('cursor/limit для прошедших: постраничная выдача со «показать ещё»', async () => {
    const { app } = await withSeededBookings()

    const first = await app.inject({
      method: 'GET',
      url: '/api/bookings?scope=past&limit=2',
    })
    expect(first.statusCode).toBe(200)
    const firstPage = first.json()
    expect(firstPage.items.map((item) => item.start)).toEqual([
      '2026-09-16T10:00:00',
      '2026-09-16T09:00:00',
    ])
    expect(firstPage.nextCursor).toBeTypeOf('string')

    const second = await app.inject({
      method: 'GET',
      url: `/api/bookings?scope=past&limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    })
    expect(second.statusCode).toBe(200)
    const secondPage = second.json()
    expect(secondPage.items.map((item) => item.start)).toEqual(['2026-09-14T11:00:00'])
    expect(secondPage.nextCursor).toBeUndefined()
    await app.close()
  })

  it('пагинация «показать ещё» устойчива к отмене между страницами', async () => {
    const { app } = await withSeededBookings()

    const first = await app.inject({
      method: 'GET',
      url: '/api/bookings?scope=past&limit=2',
    })
    const firstPage = first.json()
    expect(firstPage.items.map((item) => item.start)).toEqual([
      '2026-09-16T10:00:00',
      '2026-09-16T09:00:00',
    ])

    const toCancel = app.bookings
      .list()
      .find((item) => item.start === '2026-09-16T10:00:00')
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/bookings/${toCancel.id}/cancel`,
    })
    expect(cancel.statusCode).toBe(200)

    const second = await app.inject({
      method: 'GET',
      url: `/api/bookings?scope=past&limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    })
    const secondPage = second.json()
    expect(secondPage.items.map((item) => item.start)).toEqual(['2026-09-14T11:00:00'])
    expect(secondPage.nextCursor).toBeUndefined()
    await app.close()
  })

  it('400 на невалидный scope, limit и cursor', async () => {
    const { app } = await withSeededBookings()
    const page = await app.inject({ method: 'GET', url: '/api/bookings?scope=future' })
    const cursor = page.json().nextCursor

    const cases = [
      '/api/bookings?scope=all',
      '/api/bookings?scope=future&limit=0',
      '/api/bookings?scope=future&limit=-5',
      `/api/bookings?scope=future&cursor=${encodeURIComponent('не-курсор')}`,
    ]
    if (cursor !== undefined) {
      cases.push(
        `/api/bookings?scope=future&limit=abc&cursor=${encodeURIComponent(cursor)}`,
      )
    }
    for (const url of cases) {
      const response = await app.inject({ method: 'GET', url })
      expect(response.statusCode, url).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })
})

describe('отмена записи владельцем: контракт', () => {
  it('переводит active → cancelled и освобождает слот', async () => {
    const { app, setNow } = makeApp()
    setNow(REFERENCE_NOW)
    const type = await seedType(app)
    const created = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T11:00:00',
      name: 'Ольга',
      email: 'olga@example.com',
    })
    const booking = created.json()

    const before = await app.inject({
      method: 'GET',
      url: `/api/types/${type.id}/slots?from=${MONDAY}&to=${MONDAY}`,
    })
    const beforeStarts = before.json().map((slot) => slot.start)
    expect(beforeStarts).not.toContain('2026-09-21T11:00:00')

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/bookings/${booking.id}/cancel`,
    })
    expect(cancel.statusCode).toBe(200)
    const cancelled = cancel.json()
    expect(cancelled.id).toBe(booking.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.start).toBe('2026-09-21T11:00:00')
    expect(cancelled.email).toBe('olga@example.com')

    const after = await app.inject({
      method: 'GET',
      url: `/api/types/${type.id}/slots?from=${MONDAY}&to=${MONDAY}`,
    })
    const afterStarts = after.json().map((slot) => slot.start)
    expect(afterStarts).toContain('2026-09-21T11:00:00')
    await app.close()
  })

  it('повторная отмена возвращает 409', async () => {
    const { app, setNow } = makeApp()
    setNow(REFERENCE_NOW)
    const type = await seedType(app)
    const created = await seedBooking(app, {
      typeId: type.id,
      start: '2026-09-21T10:00:00',
      name: 'Ольга',
      email: 'olga@example.com',
    })
    const booking = created.json()

    const first = await app.inject({
      method: 'POST',
      url: `/api/bookings/${booking.id}/cancel`,
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: `/api/bookings/${booking.id}/cancel`,
    })
    expect(second.statusCode).toBe(409)
    expect(second.json().message).toBeTypeOf('string')
    await app.close()
  })

  it('несуществующая запись возвращает 404', async () => {
    const { app } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/bookings/unknown-id/cancel',
    })
    expect(response.statusCode).toBe(404)
    expect(response.json().message).toBeTypeOf('string')
    await app.close()
  })
})