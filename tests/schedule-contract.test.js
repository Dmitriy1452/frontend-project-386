import { describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createBookingTypesStore } from '../backend/src/domain/bookingTypes.js'
import { createScheduleStore } from '../backend/src/domain/schedule.js'

function makeApp({ schedule, bookingTypes } = {}) {
  return buildApp({
    schedule: schedule ?? createScheduleStore(),
    ...(bookingTypes ? { bookingTypes } : {}),
  })
}

function closedWeekSchedule() {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: [],
    })),
  }
}

function weekWithMondayOpen() {
  const week = closedWeekSchedule()
  week.days[0].intervals = [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '17:00' },
  ]
  return week
}

describe('контракт недельного расписания (buildApp + inject)', () => {
  it('GET /api/schedule возвращает закрытую неделю из 7 дней по умолчанию', async () => {
    const app = makeApp()
    const response = await app.inject({ method: 'GET', url: '/api/schedule' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(closedWeekSchedule())
    await app.close()
  })

  it('PUT сохраняет полное расписание, GET отражает его целиком', async () => {
    const app = makeApp()
    const week = weekWithMondayOpen()

    const put = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: week,
    })
    expect(put.statusCode).toBe(200)
    expect(put.json()).toEqual(week)

    const get = await app.inject({ method: 'GET', url: '/api/schedule' })
    expect(get.statusCode).toBe(200)
    expect(get.json()).toEqual(week)
    await app.close()
  })

  it('PUT день с пустыми интервалами делает день закрытым', async () => {
    const app = makeApp()
    const week = closedWeekSchedule()
    week.days[4].intervals = []

    const put = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: week,
    })
    expect(put.statusCode).toBe(200)

    const get = await app.inject({ method: 'GET', url: '/api/schedule' })
    expect(get.json().days[4].intervals).toEqual([])
    await app.close()
  })

  it('PUT нормализует порядок дней и интервалов к каноническому виду', async () => {
    const app = makeApp()
    const shuffled = closedWeekSchedule()
    shuffled.days = [
      { dayOfWeek: 7, intervals: [] },
      {
        dayOfWeek: 1,
        intervals: [
          { start: '14:00', end: '17:00' },
          { start: '09:00', end: '12:00' },
        ],
      },
      { dayOfWeek: 3, intervals: [] },
      { dayOfWeek: 2, intervals: [] },
      { dayOfWeek: 4, intervals: [] },
      { dayOfWeek: 5, intervals: [] },
      { dayOfWeek: 6, intervals: [] },
    ]

    const put = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: shuffled,
    })
    expect(put.statusCode).toBe(200)

    const expected = closedWeekSchedule()
    expected.days[0].intervals = [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ]
    expect(put.json()).toEqual(expected)
    await app.close()
  })

  it('случай 400 для структурно невалидного расписания', async () => {
    const app = makeApp()

    const closedWeek = closedWeekSchedule()
    const duplicateDow = closedWeekSchedule()
    duplicateDow.days[1].dayOfWeek = 1

    const badCases = [
      { name: 'нет days', payload: {} },
      { name: '6 дней', payload: { days: closedWeek.days.slice(0, 6) } },
      {
        name: '8 дней',
        payload: {
          days: [...closedWeek.days, { dayOfWeek: 8, intervals: [] }],
        },
      },
      { name: 'повторный dayOfWeek', payload: duplicateDow },
      {
        name: 'день без intervals',
        payload: {
          days: [
            { dayOfWeek: 1 },
            { dayOfWeek: 2, intervals: [] },
            { dayOfWeek: 3, intervals: [] },
            { dayOfWeek: 4, intervals: [] },
            { dayOfWeek: 5, intervals: [] },
            { dayOfWeek: 6, intervals: [] },
            { dayOfWeek: 7, intervals: [] },
          ],
        },
      },
      {
        name: 'intervals не массив',
        payload: {
          days: [
            { dayOfWeek: 1, intervals: '09:00-10:00' },
            { dayOfWeek: 2, intervals: [] },
            { dayOfWeek: 3, intervals: [] },
            { dayOfWeek: 4, intervals: [] },
            { dayOfWeek: 5, intervals: [] },
            { dayOfWeek: 6, intervals: [] },
            { dayOfWeek: 7, intervals: [] },
          ],
        },
      },
    ]

    for (const { name, payload } of badCases) {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedule',
        payload,
      })
      expect(response.statusCode, name).toBe(400)
      expect(response.json().message, name).toBeTypeOf('string')
    }
    await app.close()
  })

  it('случай 400 для интервалов вне суток и неверной структуры времени', async () => {
    const app = makeApp()

    const badTimes = [
      { start: '24:00', end: '10:00' },
      { start: '9:00', end: '10:00' },
      { start: '10:60', end: '18:00' },
      { start: '09:00', end: '25:00' },
      { start: 'ab:cd', end: '10:00' },
    ]

    for (const interval of badTimes) {
      const payload = closedWeekSchedule()
      payload.days[0].intervals = [interval]
      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedule',
        payload,
      })
      expect(
        response.statusCode,
        `start=${interval.start} end=${interval.end}`,
      ).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })

  it('случай 400 для start >= end', async () => {
    const app = makeApp()

    const invalidIntervals = [
      { start: '10:00', end: '10:00' },
      { start: '18:00', end: '09:00' },
      { start: '12:30', end: '11:00' },
    ]

    for (const interval of invalidIntervals) {
      const payload = closedWeekSchedule()
      payload.days[2].intervals = [interval]
      const response = await app.inject({
        method: 'PUT',
        url: '/api/schedule',
        payload,
      })
      expect(
        response.statusCode,
        `start=${interval.start} end=${interval.end}`,
      ).toBe(400)
      expect(response.json().message).toContain('начинаться раньше конца')
    }
    await app.close()
  })

  it('невалидный PUT не меняет сохранённое расписание', async () => {
    const app = makeApp()
    const valid = weekWithMondayOpen()
    await app.inject({ method: 'PUT', url: '/api/schedule', payload: valid })

    const invalid = closedWeekSchedule()
    invalid.days[0].intervals = [{ start: '12:00', end: '09:00' }]
    const response = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: invalid,
    })
    expect(response.statusCode).toBe(400)

    const get = await app.inject({ method: 'GET', url: '/api/schedule' })
    expect(get.json()).toEqual(valid)
    await app.close()
  })

  it('правка расписания не затрагивает другие сущности (типы звонков)', async () => {
    const typesStore = createBookingTypesStore()
    typesStore.create({ name: 'Консультация', durationMinutes: 30 })
    const app = makeApp({
      schedule: createScheduleStore(weekWithMondayOpen()),
      bookingTypes: typesStore,
    })

    const put = await app.inject({
      method: 'PUT',
      url: '/api/schedule',
      payload: closedWeekSchedule(),
    })
    expect(put.statusCode).toBe(200)

    const types = await app.inject({ method: 'GET', url: '/api/types' })
    expect(types.json()).toHaveLength(1)
    expect(types.json()[0]).toMatchObject({ name: 'Консультация', durationMinutes: 30 })
    await app.close()
  })

  it('GET отражает расписание, заранее загруженное в хранилище', async () => {
    const app = makeApp({ schedule: createScheduleStore(weekWithMondayOpen()) })
    const response = await app.inject({ method: 'GET', url: '/api/schedule' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(weekWithMondayOpen())
    await app.close()
  })
})