/**
 * Генерация свободных слотов.
 *
 * Слот — вычисляемая проекция: не хранится, выводится из недельного
 * расписания доступности и длительности выбранного типа звонка.
 * Начало слота кратно 15 минутам, слот целиком лежит внутри непрерывного
 * свободного интервала и не пересекает ни одну активную запись.
 */

import {
  addDays,
  dateTimeToMinutes,
  dayNumber,
  isoDayOfWeek,
  minutesToTime,
  timeToMinutes,
} from './time.js'

const STEP_MINUTES = 15
const WINDOW_DAYS = 14

/** Пересекаются ли два полуоткрытых интервала [aStart, aEnd) и [bStart, bEnd). */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Вычитает занятые интервалы из открытых и возвращает непрерывные
 * свободные участки (в минутах от начала суток).
 */
export function computeFreeRuns(openIntervals, occupiedIntervals) {
  const occupied = [...occupiedIntervals].sort((a, b) => a.start - b.start)
  const free = []
  for (const open of openIntervals) {
    let cursor = open.start
    for (const occ of occupied) {
      if (occ.end <= cursor) {
        continue
      }
      if (occ.start >= open.end) {
        break
      }
      if (occ.start > cursor) {
        free.push({ start: cursor, end: Math.min(occ.start, open.end) })
      }
      cursor = Math.max(cursor, occ.end)
      if (cursor >= open.end) {
        break
      }
    }
    if (cursor < open.end) {
      free.push({ start: cursor, end: open.end })
    }
  }
  return free
}

/** Занятые интервалы активных записей для конкретной даты (в минутах от 00:00). */
function occupiedRunsOn(date, activeBookings) {
  const startOfDay = dayNumber(date) * 1440
  const endOfDay = startOfDay + 1440
  const occupied = []
  for (const booking of activeBookings) {
    if (booking.status !== 'active') {
      continue
    }
    const start = dateTimeToMinutes(booking.start)
    if (start < startOfDay || start >= endOfDay) {
      continue
    }
    occupied.push({
      start: start - startOfDay,
      end: dateTimeToMinutes(booking.end) - startOfDay,
    })
  }
  return occupied
}

/**
 * Свободные слоты для типа в диапазоне дат в локальном времени владельца.
 * Диапазон дополнительно ограничивается окном бронирования: ближайшие
 * WINDOW_DAYS дней, начиная с текущей даты (сегодня включительно).
 */
export function generateSlots({ schedule, bookings, type, from, to, now }) {
  const durationMinutes = type.durationMinutes
  const today = now.slice(0, 10)
  const nowMinutes = dateTimeToMinutes(now)
  const windowTo = addDays(today, WINDOW_DAYS - 1)
  const firstDay = clampEarliest(from, today)
  const lastDay = clampLatest(to, windowTo)
  const activeBookings = bookings ?? []

  const slots = []
  for (let day = firstDay; dayNumber(day) <= dayNumber(lastDay); day = addDays(day, 1)) {
    const dayOfWeek = isoDayOfWeek(day)
    const scheduleDay = schedule.days.find((item) => item.dayOfWeek === dayOfWeek)
    const openIntervals = (scheduleDay?.intervals ?? []).map((interval) => ({
      start: timeToMinutes(interval.start),
      end: timeToMinutes(interval.end),
    }))
    if (openIntervals.length === 0) {
      continue
    }

    const occupied = occupiedRunsOn(day, activeBookings)
    const freeRuns = computeFreeRuns(openIntervals, occupied)

    for (const run of freeRuns) {
      const firstStart = Math.ceil(run.start / STEP_MINUTES) * STEP_MINUTES
      for (
        let start = firstStart;
        start + durationMinutes <= run.end;
        start += STEP_MINUTES
      ) {
        const slotMinutes = dayNumber(day) * 1440 + start
        if (slotMinutes < nowMinutes) {
          continue
        }
        slots.push({
          start: `${day}T${minutesToTime(start)}`,
          end: `${day}T${minutesToTime(start + durationMinutes)}`,
        })
      }
    }
  }
  return slots
}

function clampEarliest(date, floor) {
  return dayNumber(date) > dayNumber(floor) ? date : floor
}

function clampLatest(date, ceiling) {
  return dayNumber(date) < dayNumber(ceiling) ? date : ceiling
}