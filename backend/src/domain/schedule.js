const DAYS_IN_WEEK = 7

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function closedDay(dayOfWeek) {
  return { dayOfWeek, intervals: [] }
}

export function defaultSchedule() {
  return {
    days: Array.from({ length: DAYS_IN_WEEK }, (_, index) => closedDay(index + 1)),
  }
}

export function validateScheduleInput(input) {
  const errors = {}
  if (!input || typeof input !== 'object' || !Array.isArray(input.days)) {
    errors.days = 'Расписание должно содержать список из 7 дней'
    return errors
  }

  if (input.days.length !== DAYS_IN_WEEK) {
    errors.days = `Расписание должно содержать ровно ${DAYS_IN_WEEK} дней`
    return errors
  }

  const seen = new Set()
  for (const day of input.days) {
    const dayOfWeek = day?.dayOfWeek
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > DAYS_IN_WEEK) {
      errors.days = 'Каждый день должен иметь dayOfWeek от 1 до 7'
      return errors
    }
    if (seen.has(dayOfWeek)) {
      errors.days = `День недели ${dayOfWeek} указан несколько раз`
      return errors
    }
    seen.add(dayOfWeek)

    if (!Array.isArray(day.intervals)) {
      errors.days = `День недели ${dayOfWeek}: intervals должен быть списком`
      return errors
    }
    for (const interval of day.intervals) {
      const start = interval?.start
      const end = interval?.end
      if (typeof start !== 'string' || !TIME_PATTERN.test(start)) {
        errors.days = `День недели ${dayOfWeek}: время «${start}» не в формате HH:MM`
        return errors
      }
      if (typeof end !== 'string' || !TIME_PATTERN.test(end)) {
        errors.days = `День недели ${dayOfWeek}: время «${end}» не в формате HH:MM`
        return errors
      }
      if (start >= end) {
        errors.days =
          `День недели ${dayOfWeek}: интервал ${start}–${end} должен начинаться раньше конца`
        return errors
      }
    }
  }
  return errors
}

export function validationErrorMessage(errors) {
  return Object.values(errors).join('; ')
}

function normalize(schedule) {
  return {
    days: [...schedule.days]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        intervals: [...day.intervals].sort((a, b) =>
          a.start.localeCompare(b.start),
        ),
      })),
  }
}

export function createScheduleStore(initialSchedule) {
  if (initialSchedule !== undefined) {
    const errors = validateScheduleInput(initialSchedule)
    if (Object.keys(errors).length > 0) {
      throw new Error(validationErrorMessage(errors))
    }
  }
  let schedule =
    initialSchedule === undefined ? defaultSchedule() : normalize(initialSchedule)

  function get() {
    return structuredClone(schedule)
  }

  function set(next) {
    const errors = validateScheduleInput(next)
    if (Object.keys(errors).length > 0) {
      return { error: 'invalid', message: validationErrorMessage(errors) }
    }
    schedule = normalize(next)
    return { schedule: get() }
  }

  return { get, set }
}