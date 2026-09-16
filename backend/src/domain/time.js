/**
 * Помощники для наивного «локального времени владельца».
 *
 * Даты: «YYYY-MM-DD», моменты: «YYYY-MM-DDTHH:MM:SS» без смещения часового
 * пояса — время считается локальным для владельца календаря, конвертация
 * часовых поясов не предусмотрена (см. spec/main.tsp).
 * Для упорядочивания используется «минута с эпохи» = целое число минут
 * от 1970-01-01 00:00:00, что детерминировано и не зависит от TZ процесса.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

const MINUTES_PER_DAY = 24 * 60

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) {
    return false
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

export function isValidLocalDateTime(value) {
  if (typeof value !== 'string' || !DATETIME_PATTERN.test(value)) {
    return false
  }
  const [datePart, timePart] = value.split('T')
  if (!isValidDate(datePart)) {
    return false
  }
  const [hours, minutes, seconds] = timePart.split(':').map(Number)
  return seconds === 0 && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/** Номер дня от эпохи (1970-01-01) для даты «YYYY-MM-DD». */
export function dayNumber(date) {
  const [year, month, day] = date.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function addDays(date, count) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + count))
  return [
    String(result.getUTCFullYear()).padStart(4, '0'),
    pad2(result.getUTCMonth() + 1),
    pad2(result.getUTCDate()),
  ].join('-')
}

/** День недели по ISO-8601: 1 = понедельник, … 7 = воскресенье. */
export function isoDayOfWeek(date) {
  const [year, month, day] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return dow === 0 ? 7 : dow
}

/** Минуты от начала суток для «HH:MM». */
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** «HH:MM:SS» из целого числа минут от начала суток. */
export function minutesToTime(minutes) {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00`
}

/** Минуты от эпохи для момента «YYYY-MM-DDTHH:MM:SS». */
export function dateTimeToMinutes(dateTime) {
  const [datePart, timePart] = dateTime.split('T')
  const [hours, minutes] = timePart.split(':').map(Number)
  return dayNumber(datePart) * MINUTES_PER_DAY + hours * 60 + minutes
}

export function addMinutes(dateTime, minutes) {
  const total = dateTimeToMinutes(dateTime) + minutes
  const days = Math.floor(total / MINUTES_PER_DAY)
  const withinDay = total % MINUTES_PER_DAY
  return `${dateAtDayNumber(days)}T${minutesToTime(withinDay)}`
}

function dateAtDayNumber(day) {
  const result = new Date(day * 86400000)
  return [
    String(result.getUTCFullYear()).padStart(4, '0'),
    pad2(result.getUTCMonth() + 1),
    pad2(result.getUTCDate()),
  ].join('-')
}

export function datePartOf(dateTime) {
  return dateTime.slice(0, 10)
}

/** «YYYY-MM-DD» из Date по локальному времени процесса. */
export function formatLocalDate(date) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

/** «YYYY-MM-DDTHH:MM:SS» из Date по локальному времени процесса. */
export function formatLocalDateTime(date) {
  const datePart = formatLocalDate(date)
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`
  return `${datePart}T${timePart}`
}

/**
 * Нормализует источник «сейчас» в детерминированный наивный момент.
 * Принимает функцию, возвращающую Date или строку «YYYY-MM-DDTHH:MM:SS».
 */
export function resolveNow(now) {
  const value = typeof now === 'function' ? now() : now
  if (typeof value === 'string' && isValidLocalDateTime(value)) {
    return value
  }
  return formatLocalDateTime(value instanceof Date ? value : new Date())
}