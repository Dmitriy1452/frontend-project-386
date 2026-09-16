import { describe, expect, it } from 'vitest'
import {
  computeFreeRuns,
  generateSlots,
  intervalsOverlap,
} from '../backend/src/domain/slots.js'
import {
  createScheduleStore,
} from '../backend/src/domain/schedule.js'

function weekOpenOn(days) {
  return createScheduleStore({
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: days.includes(index + 1) ? [{ start: '09:00', end: '12:00' }] : [],
    })),
  })
}

function booking({ start, end, status = 'active' }) {
  return {
    id: 'b',
    type: { id: 't', name: 'Тип', durationMinutes: 30 },
    start,
    end,
    name: 'Имя',
    email: 'name@example.com',
    status,
  }
}

const NOW = '2026-09-21T09:00:00'
const MONDAY = '2026-09-21'

describe('intervalsOverlap', () => {
  it('считает полуоткрытые интервалы пересекающимися только при реальном пересечении', () => {
    expect(intervalsOverlap(10, 20, 15, 25)).toBe(true)
    expect(intervalsOverlap(10, 20, 0, 15)).toBe(true)
    expect(intervalsOverlap(10, 20, 20, 30)).toBe(false)
    expect(intervalsOverlap(10, 20, 0, 10)).toBe(false)
    expect(intervalsOverlap(10, 20, 5, 10)).toBe(false)
    expect(intervalsOverlap(10, 20, 15, 20)).toBe(true)
  })
})

describe('computeFreeRuns', () => {
  it('вычитает занятые интервалы из открытых и возвращает непрерывные свободные участки', () => {
    expect(computeFreeRuns([{ start: 0, end: 100 }], [{ start: 20, end: 60 }])).toEqual([
      { start: 0, end: 20 },
      { start: 60, end: 100 },
    ])
  })

  it('оставляет открытый интервал нетронутым, если занятых нет', () => {
    expect(computeFreeRuns([{ start: 30, end: 50 }], [])).toEqual([
      { start: 30, end: 50 },
    ])
  })

  it('полностью убирает открытый интервал, если он целиком занят', () => {
    expect(
      computeFreeRuns([{ start: 30, end: 50 }], [{ start: 20, end: 60 }]),
    ).toEqual([])
    expect(
      computeFreeRuns([{ start: 30, end: 50 }], [{ start: 30, end: 50 }]),
    ).toEqual([])
  })

  it('не выходит за границы открытого интервала при наложении занятого', () => {
    expect(
      computeFreeRuns([{ start: 0, end: 60 }], [{ start: 30, end: 90 }]),
    ).toEqual([{ start: 0, end: 30 }])
  })

  it('обрабатывает несколько открытых и занятых интервалов', () => {
    const runs = computeFreeRuns(
      [
        { start: 0, end: 60 },
        { start: 120, end: 180 },
      ],
      [
        { start: 10, end: 20 },
        { start: 40, end: 50 },
        { start: 130, end: 170 },
      ],
    )
    expect(runs).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 40 },
      { start: 50, end: 60 },
      { start: 120, end: 130 },
      { start: 170, end: 180 },
    ])
  })
})

describe('generateSlots', () => {
  it('генерирует слоты с шагом 15 минут внутри открытого интервала', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    expect(slots).toHaveLength(11)
    expect(slots[0]).toEqual({
      start: '2026-09-21T09:00:00',
      end: '2026-09-21T09:30:00',
    })
    expect(slots[1]).toEqual({
      start: '2026-09-21T09:15:00',
      end: '2026-09-21T09:45:00',
    })
    expect(slots.at(-1)).toEqual({
      start: '2026-09-21T11:30:00',
      end: '2026-09-21T12:00:00',
    })
  })

  it('не даёт слот, который «хвостом» вылезает за конец интервала', () => {
    const slots = generateSlots({
      schedule: createScheduleStore({
        days: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index + 1,
          intervals: index === 0 ? [{ start: '09:00', end: '10:10' }] : [],
        })),
      }).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    const starts = slots.map((slot) => slot.start)
    expect(starts).toContain('2026-09-21T09:30:00')
    expect(starts).not.toContain('2026-09-21T09:45:00')
    expect(starts).not.toContain('2026-09-21T10:00:00')
  })

  it('выравнивает первое начало слота до 15 минут, если интервал начинается не кратно 15', () => {
    const schedule = weekOpenOn([1]).get()
    schedule.days[0].intervals = [{ start: '09:07', end: '10:00' }]
    const slots = generateSlots({
      schedule,
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    expect(slots.map((slot) => slot.start)).toEqual([
      '2026-09-21T09:15:00',
      '2026-09-21T09:30:00',
    ])
  })

  it('исключает слоты, пересекающиеся с активными записями', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [
        booking({ start: '2026-09-21T09:00:00', end: '2026-09-21T09:30:00' }),
      ],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    const starts = slots.map((slot) => slot.start)
    expect(starts).not.toContain('2026-09-21T09:00:00')
    expect(starts).not.toContain('2026-09-21T09:15:00')
    expect(starts).toContain('2026-09-21T09:30:00')
  })

  it('не блокирует слот отменённой записью', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [
        booking({
          start: '2026-09-21T09:00:00',
          end: '2026-09-21T09:30:00',
          status: 'cancelled',
        }),
      ],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    expect(slots.map((slot) => slot.start)).toContain('2026-09-21T09:00:00')
  })

  it('не выводит слоты, уже начавшиеся к моменту «сейчас»', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: '2026-09-21T10:00:00',
    })
    const starts = slots.map((slot) => slot.start)
    expect(starts).not.toContain('2026-09-21T09:00:00')
    expect(starts).not.toContain('2026-09-21T09:45:00')
    expect(starts[0]).toBe('2026-09-21T10:00:00')
  })

  it('отдаёт время в локальном формате владельца YYYY-MM-DDTHH:MM:SS', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 20 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    for (const slot of slots) {
      expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/)
    }
  })

  it('длительность типа определяет конец слота', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 45 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    expect(slots[0]).toEqual({
      start: '2026-09-21T09:00:00',
      end: '2026-09-21T09:45:00',
    })
  })

  it('ограничивает выдачу окном бронирования в 14 дней от текущей даты', () => {
    const openEveryDay = createScheduleStore({
      days: Array.from({ length: 7 }, (_, index) => ({
        dayOfWeek: index + 1,
        intervals: [{ start: '09:00', end: '12:00' }],
      })),
    })
    const slots = generateSlots({
      schedule: openEveryDay.get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: '2026-09-21',
      to: '2026-10-31',
      now: NOW,
    })
    const dates = [...new Set(slots.map((slot) => slot.start.slice(0, 10)))]
    expect(dates[0]).toBe('2026-09-21')
    expect(dates.at(-1)).toBe('2026-10-04')
    expect(dates).toHaveLength(14)
  })

  it('не выдаёт слоты за даты до текущей', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([1, 2, 3, 4, 5, 6, 7]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: '2026-09-14',
      to: '2026-09-20',
      now: NOW,
    })
    expect(slots).toHaveLength(0)
  })

  it('не выдаёт слоты в закрытые дни', () => {
    const slots = generateSlots({
      schedule: weekOpenOn([2]).get(),
      bookings: [],
      type: { id: 't', name: 'Тип', durationMinutes: 30 },
      from: MONDAY,
      to: MONDAY,
      now: NOW,
    })
    expect(slots).toHaveLength(0)
  })
})