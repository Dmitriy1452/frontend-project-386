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

const DEFAULT_PAGE_LIMIT = 100
const MAX_PAGE_LIMIT = 100

/**
 * Курсор «по ключу»: позиция в отсортированном списке, закодированная как
 * (start, id) последней выданной записи. Клиент не должен раскрывать его
 * содержимое; сервер лишь продолжает выдачу строго после этого ключа.
 */
function encodeCursor(start, id) {
  return Buffer.from(`${start}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor) {
  let decoded
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const separator = decoded.lastIndexOf('|')
  if (separator < 0) {
    return null
  }
  const start = decoded.slice(0, separator)
  const id = decoded.slice(separator + 1)
  if (!isValidLocalDateTime(start) || id === '') {
    return null
  }
  return { start, id }
}

/** Стоит ли запись строго после курсора в направлении сортировки. */
function startsAfter(booking, anchor, isFuture) {
  const bookingStart = dateTimeToMinutes(booking.start)
  const anchorStart = dateTimeToMinutes(anchor.start)
  if (bookingStart !== anchorStart) {
    return isFuture ? bookingStart > anchorStart : bookingStart < anchorStart
  }
  return isFuture
    ? booking.id > anchor.id
    : booking.id < anchor.id
}

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

  /**
   * Страница списка записей владельца в выбранном временном диапазоне.
   * Будущие (start >= «сейчас») сортируются по возрастанию, прошедшие
   * (start < «сейчас») — по убыванию. Отменённые записи остаются в своей
   * временной группе. Пагинация — курсор «по ключу» (start, id) плюс limit,
   * поэтому удаление или отмена записей между страницами не сдвигает выдачу.
   */
  function page({ scope, cursor, limit } = {}) {
    const requestedLimit = limit === undefined ? DEFAULT_PAGE_LIMIT : Number(limit)
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_PAGE_LIMIT) {
      return { error: 'invalid', message: 'limit должен быть целым числом от 1 до 100' }
    }
    const anchor = cursor === undefined || cursor === null ? null : decodeCursor(cursor)
    if (cursor !== undefined && cursor !== null && anchor === null) {
      return { error: 'invalid', message: 'cursor указан некорректно' }
    }

    const isFuture = scope === 'future'
    const nowMinutes = dateTimeToMinutes(currentNow())
    const selected = bookings.filter((booking) => {
      const startMinutes = dateTimeToMinutes(booking.start)
      return isFuture ? startMinutes >= nowMinutes : startMinutes < nowMinutes
    })
    const sorted = [...selected].sort((a, b) => {
      const aStart = dateTimeToMinutes(a.start)
      const bStart = dateTimeToMinutes(b.start)
      const byTime = isFuture ? aStart - bStart : bStart - aStart
      return byTime !== 0 ? byTime : isFuture ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
    })

    let startIndex = 0
    if (anchor) {
      startIndex = sorted.findIndex((item) => startsAfter(item, anchor, isFuture))
      if (startIndex === -1) {
        return { items: [] }
      }
    }

    const items = sorted.slice(startIndex, startIndex + requestedLimit)
    const hasMore = startIndex + requestedLimit < sorted.length
    const lastItem = items[items.length - 1]
    return {
      items: structuredClone(items),
      ...(hasMore && lastItem ? { nextCursor: encodeCursor(lastItem.start, lastItem.id) } : {}),
    }
  }

  function cancel(id) {
    const booking = bookings.find((item) => item.id === id)
    if (!booking) {
      return { error: 'notFound' }
    }
    if (booking.status === 'cancelled') {
      return { error: 'alreadyCancelled' }
    }
    booking.status = 'cancelled'
    return { booking: structuredClone(booking) }
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

  return { list, create, page, cancel }
}