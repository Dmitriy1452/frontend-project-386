/**
 * Чистая логика недельной сетки «Календарь» (тикет #25).
 *
 * Сетка строится из недельного расписания и записей недели, возвращаемых
 * GET /api/calendar. Время — наивное локальное время владельца (без
 * конвертации часовых поясов). Каждая ячейка сетки получает одно из трёх
 * состояний:
 *  - «open» (открыто и свободно): попадает в открытый интервал расписания
 *    и не пересекается с активной записью;
 *  - «occupied» (открыто и занято): пересекается с активной записью —
 *    на ячейке видно имя посетителя и название типа звонка;
 *  - «closed» (закрыто): вне открытых интервалов или закрытый день.
 *
 * Отменённые записи слот не занимают: их интервалы не делают ячейку
 * «occupied», поэтому после отмены время снова свободно.
 */

const CELL_MINUTES = 15
const MINUTES_PER_DAY = 24 * 60

export const DAY_NAMES = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function formatLocalDate(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

/** «YYYY-MM-DD» даты понедельника, на который приходится указанный день. */
export function weekStartOf(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return formatLocalDate(result)
}

export function addDaysToDate(date, count) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + count))
  return [
    String(result.getUTCFullYear()).padStart(4, '0'),
    pad2(result.getUTCMonth() + 1),
    pad2(result.getUTCDate()),
  ].join('-')
}

function dayNumber(date) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

function minutesToHourLabel(minutes) {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

/**
 * Строит модель недельной сетки. Возвращает пустые dayHeaders и rows, когда
 * в неделе нет ни открытых интервалов, ни активных записей (нечего показывать).
 */
export function buildCalendarGrid({ weekStart, schedule, bookings }) {
  const weekFrom = dayNumber(weekStart)
  const weekTo = weekFrom + 6
  const openByDay = new Map(
    (schedule?.days ?? []).map((day) => [day.dayOfWeek, day.intervals ?? []]),
  )
  const allBookings = bookings ?? []
  const activeBookings = allBookings.filter(
    (booking) => booking.status === 'active',
  )

  let windowStart = MINUTES_PER_DAY
  let windowEnd = 0
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
    for (const interval of openByDay.get(dayOfWeek) ?? []) {
      windowStart = Math.min(windowStart, timeToMinutes(interval.start))
      windowEnd = Math.max(windowEnd, timeToMinutes(interval.end))
    }
  }
  const activeInWeek = []
  for (const booking of activeBookings) {
    const bookingDay = dayNumber(booking.start.slice(0, 10))
    if (bookingDay < weekFrom || bookingDay > weekTo) {
      continue
    }
    activeInWeek.push(booking)
    windowStart = Math.min(
      windowStart,
      timeToMinutes(booking.start.slice(11, 16)),
    )
    windowEnd = Math.max(
      windowEnd,
      timeToMinutes(booking.end.slice(11, 16)),
    )
  }
  if (windowStart >= windowEnd) {
    return { weekStart, weekEnd: addDaysToDate(weekStart, 6), dayHeaders: [], rows: [] }
  }

  windowStart = Math.floor(windowStart / CELL_MINUTES) * CELL_MINUTES
  windowEnd = Math.ceil(windowEnd / CELL_MINUTES) * CELL_MINUTES

  const dayHeaders = Array.from({ length: 7 }, (_, offset) => ({
    dayOfWeek: offset + 1,
    date: addDaysToDate(weekStart, offset),
    name: DAY_NAMES[offset + 1],
  }))
  const rows = []
  for (let from = windowStart; from < windowEnd; from += CELL_MINUTES) {
    const to = from + CELL_MINUTES
    const days = []
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDaysToDate(weekStart, offset)
      const dayOfWeek = offset + 1
      const booking = activeInWeek.find((item) => {
        const itemDay = item.start.slice(0, 10)
        if (itemDay !== date) {
          return false
        }
        return intervalsOverlap(
          from,
          to,
          timeToMinutes(item.start.slice(11, 16)),
          timeToMinutes(item.end.slice(11, 16)),
        )
      })
      if (booking) {
        days.push({
          state: 'occupied',
          date,
          booking: {
            visitorName: booking.name,
            typeName: booking.type.name,
          },
        })
        continue
      }
      const open = (openByDay.get(dayOfWeek) ?? []).some(
        (interval) =>
          timeToMinutes(interval.start) <= from && to <= timeToMinutes(interval.end),
      )
      days.push({ state: open ? 'open' : 'closed', date })
    }
    rows.push({
      from,
      to,
      hourLabel: from % 60 === 0 ? minutesToHourLabel(from) : null,
      days,
    })
  }

  return {
    weekStart,
    weekEnd: addDaysToDate(weekStart, 6),
    dayHeaders,
    dayStartMinutes: windowStart,
    dayEndMinutes: windowEnd,
    rows,
  }
}