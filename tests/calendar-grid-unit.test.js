import { describe, expect, it } from 'vitest'
import {
  addDaysToDate,
  buildCalendarGrid,
  formatLocalDate,
  intervalsOverlap,
  weekStartOf,
} from '../frontend/src/pages/calendarGrid.js'

const MONDAY = '2026-09-21'

function scheduleWith(days) {
  const week = { days: [] }
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
    week.days.push({ dayOfWeek, intervals: days[dayOfWeek] ?? [] })
  }
  return week
}

function activeBooking({ start, end, name, typeName }) {
  return {
    id: `${start}-${name}`,
    type: { id: 't', name: typeName, durationMinutes: 30 },
    start,
    end,
    name,
    email: `${name.toLowerCase()}@example.com`,
    status: 'active',
  }
}

function cancelledBooking({ start, end, name, typeName }) {
  return { ...activeBooking({ start, end, name, typeName }), status: 'cancelled' }
}

function cellByDay(grid, dayOfWeek, from) {
  const row = grid.rows.find((item) => item.from === from)
  return row?.days[dayOfWeek - 1]
}

describe('weekStartOf и границы недели', () => {
  it('находит понедельник недели для любого дня внутри неё', () => {
    expect(weekStartOf(new Date(2026, 8, 21))).toBe('2026-09-21')
    expect(weekStartOf(new Date(2026, 8, 23))).toBe('2026-09-21')
    expect(weekStartOf(new Date(2026, 8, 25))).toBe('2026-09-21')
    expect(weekStartOf(new Date(2026, 8, 27))).toBe('2026-09-21')
    expect(weekStartOf(new Date(2026, 8, 28))).toBe('2026-09-28')
  })

  it('деньHeaders покрывают понедельник–воскресенье с датами', () => {
    const grid = buildCalendarGrid({
      weekStart: MONDAY,
      schedule: scheduleWith({
        1: [{ start: '09:00', end: '12:00' }],
      }),
      bookings: [],
    })
    expect(grid.weekStart).toBe(MONDAY)
    expect(grid.weekEnd).toBe('2026-09-27')
    expect(grid.dayHeaders).toHaveLength(7)
    expect(grid.dayHeaders[0]).toMatchObject({
      dayOfWeek: 1,
      date: '2026-09-21',
      name: 'Понедельник',
    })
    expect(grid.dayHeaders[6]).toMatchObject({
      dayOfWeek: 7,
      date: '2026-09-27',
      name: 'Воскресенье',
    })
  })

  it('addDaysToDate переносит через границы месяца', () => {
    expect(addDaysToDate('2026-09-27', 1)).toBe('2026-09-28')
    expect(addDaysToDate('2026-09-30', 1)).toBe('2026-10-01')
    expect(formatLocalDate(new Date(2026, 8, 21))).toBe('2026-09-21')
  })

  it('записей и открытых интервалов нет — сетка пустая', () => {
    const grid = buildCalendarGrid({
      weekStart: MONDAY,
      schedule: scheduleWith({}),
      bookings: [],
    })
    expect(grid.rows).toEqual([])
  })
})

describe('buildCalendarGrid: три состояния', () => {
  const schedule = scheduleWith({
    1: [{ start: '09:00', end: '12:00' }],
    2: [{ start: '14:00', end: '16:00' }],
  })
  const bookings = [
    activeBooking({
      start: '2026-09-21T10:00:00',
      end: '2026-09-21T10:30:00',
      name: 'Иван',
      typeName: 'Консультация',
    }),
    cancelledBooking({
      start: '2026-09-21T11:00:00',
      end: '2026-09-21T11:30:00',
      name: 'Анна',
      typeName: 'Синк',
    }),
  ]

  it('открытое и свободное время помечается open', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    expect(cellByDay(grid, 1, 540).state).toBe('open')
    expect(cellByDay(grid, 1, 690).state).toBe('open')
  })

  it('активная запись помечает ячейки как occupied', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    expect(cellByDay(grid, 1, 600).state).toBe('occupied')
    expect(cellByDay(grid, 1, 615).state).toBe('occupied')
  })

  it('на занятой ячейке видны имя посетителя и название типа звонка', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    const cell = cellByDay(grid, 1, 600)
    expect(cell.booking).toEqual({
      visitorName: 'Иван',
      typeName: 'Консультация',
    })
  })

  it('отменённая запись не занимает время: ячейка остаётся свободной', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    const cell = cellByDay(grid, 1, 660)
    expect(cell.state).toBe('open')
    expect(cell.booking).toBeUndefined()
  })

  it('закрытый день и перерыв помечаются closed', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    expect(cellByDay(grid, 3, 540).state).toBe('closed')
    expect(cellByDay(grid, 1, 720).state).toBe('closed')
    expect(cellByDay(grid, 2, 780).state).toBe('closed')
  })

  it('окно сетки строится от открытых интервалов до конца активных записей', () => {
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    expect(grid.dayStartMinutes).toBe(540)
    expect(grid.dayEndMinutes).toBe(960)
  })
})

describe('buildCalendarGrid: границы недели', () => {
  it('запись в воскресенье попадает в сетку, следующая неделя исключается', () => {
    const schedule = scheduleWith({
      1: [{ start: '09:00', end: '12:00' }],
      7: [{ start: '09:00', end: '12:00' }],
    })
    const bookings = [
      activeBooking({
        start: '2026-09-27T09:00:00',
        end: '2026-09-27T09:30:00',
        name: 'Вера',
        typeName: 'Консультация',
      }),
      activeBooking({
        start: '2026-09-28T09:00:00',
        end: '2026-09-28T09:30:00',
        name: 'Следующая неделя',
        typeName: 'Синк',
      }),
    ]
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule, bookings })
    expect(cellByDay(grid, 7, 540).state).toBe('occupied')
    const names = grid.rows.flatMap((row) =>
      row.days.filter((cell) => cell.booking).map((cell) => cell.booking.visitorName),
    )
    expect(names).toContain('Вера')
    expect(names).not.toContain('Следующая неделя')
  })
})

describe('buildCalendarGrid: правка расписания', () => {
  it('закрытие дня отражается на сетке, но активные записи сохраняются', () => {
    const openMonday = scheduleWith({
      1: [{ start: '09:00', end: '12:00' }],
    })
    const bookings = [
      activeBooking({
        start: '2026-09-21T10:00:00',
        end: '2026-09-21T10:30:00',
        name: 'Иван',
        typeName: 'Консультация',
      }),
    ]
    const grid = buildCalendarGrid({ weekStart: MONDAY, schedule: openMonday, bookings })
    expect(cellByDay(grid, 1, 540).state).toBe('open')
    expect(cellByDay(grid, 1, 600).state).toBe('occupied')

    const closedMonday = scheduleWith({})
    const afterEdit = buildCalendarGrid({
      weekStart: MONDAY,
      schedule: closedMonday,
      bookings,
    })
    expect(cellByDay(afterEdit, 1, 540)).toBeUndefined()
    expect(cellByDay(afterEdit, 1, 600).state).toBe('occupied')
  })
})

describe('intervalsOverlap', () => {
  it('работает на полуоткрытых интервалах', () => {
    expect(intervalsOverlap(600, 630, 615, 645)).toBe(true)
    expect(intervalsOverlap(600, 630, 630, 660)).toBe(false)
    expect(intervalsOverlap(600, 630, 540, 600)).toBe(false)
    expect(intervalsOverlap(600, 630, 540, 645)).toBe(true)
  })
})