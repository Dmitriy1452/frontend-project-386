/**
 * Хранилище записей на звонок.
 *
 * Создание записи атомарно проверяет главный инвариант: выбранный слот
 * целиком лежит внутри открытого интервала расписания и не пересекает ни
 * одну активную запись (записи любых типов конкурируют за одно и то же
 * время). Проверка и вставка выполняются одним синхронным вызовом, поэтому
 * при гонке параллельных запросов ровно одна получает 201, остальные — 409.
 */

import { randomUUID } from 'node:crypto'
import {
  addDays,
  addMinutes,
  dateTimeToMinutes,
  dayNumber,
  datePartOf,
  isoDayOfWeek,
  isValidLocalDateTime,
  resolveNow,
  timeToMinutes,
} from './time.js'
import { intervalsOverlap } from './slots.js'

const WINDOW_DAYS = 14
const MINUTES_PER_DAY = 1440

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

export function validateBookingInput(input = {}) {
  const errors = {}
  if (typeof input.typeId !== 'string' || input.typeId === '') {
    errors.typeId = 'Укажите тип звонка'
  }
  if (typeof input.start !== 'string' || !isValidLocalDateTime(input.start)) {
    errors.start = 'Время слота указано некорректно'
  }
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    errors.name = 'Укажите имя'
  }
  if (typeof input.email !== 'string' || !EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Укажите корректный email'
  }
  return errors
}

export function validationErrorMessage(errors) {
  return Object.values(errors).join('; ')
}

export function createBookingsStore({ bookingTypes, schedule, now } = {}) {
  const bookings = []
  const currentNow = () => resolveNow(now)

  function list() {
    return structuredClone(bookings)
  }

  function conflict({ type, start, durationMinutes }) {
    if (!type) {
      return null
    }
    const nowDateTime = currentNow()
    const nowMinutes = dateTimeToMinutes(nowDateTime)
    const startMinutes = dateTimeToMinutes(start)
    const today = datePartOf(nowDateTime)
    const latestDate = addDays(today, WINDOW_DAYS - 1)

    if (startMinutes < nowMinutes) {
      return 'Это время уже прошло'
    }
    if (dayNumber(datePartOf(start)) > dayNumber(latestDate)) {
      return 'Это время выходит за пределы окна записи (14 дней)'
    }

    const currentSchedule = schedule.get()
    const dayOfWeek = isoDayOfWeek(datePartOf(start))
    const scheduleDay = currentSchedule.days.find((item) => item.dayOfWeek === dayOfWeek)
    const openIntervals = (scheduleDay?.intervals ?? []).map((interval) => ({
      start: timeToMinutes(interval.start),
      end: timeToMinutes(interval.end),
    }))
    const startInDay = startMinutes - dayNumber(datePartOf(start)) * MINUTES_PER_DAY
    const endInDay = startInDay + durationMinutes
    const insideOpenInterval = openIntervals.some(
      (interval) => interval.start <= startInDay && endInDay <= interval.end,
    )
    if (!insideOpenInterval) {
      return 'Это время не входит в расписание приёма'
    }

    const endMinutes = startMinutes + durationMinutes
    for (const booking of bookings) {
      if (booking.status !== 'active') {
        continue
      }
      const bookingStart = dateTimeToMinutes(booking.start)
      const bookingEnd = dateTimeToMinutes(booking.end)
      if (intervalsOverlap(startMinutes, endMinutes, bookingStart, bookingEnd)) {
        return 'Это время уже занято другой записью'
      }
    }
    return null
  }

  function create(input) {
    const { typeId, start, name, email, comment } = input
    const type = bookingTypes.list().find((item) => item.id === typeId)
    if (!type) {
      return { error: 'notFound' }
    }

    const conflictMessage = conflict({
      type,
      start,
      durationMinutes: type.durationMinutes,
    })
    if (conflictMessage) {
      return { error: 'conflict', message: conflictMessage }
    }

    const end = addMinutes(start, type.durationMinutes)
    const booking = {
      id: randomUUID(),
      type: {
        id: type.id,
        name: type.name,
        durationMinutes: type.durationMinutes,
      },
      start,
      end,
      name: name.trim(),
      email: email.trim(),
      comment,
      status: 'active',
    }
    bookings.push(booking)
    return { booking }
  }

  return { list, create }
}