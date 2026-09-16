import { describe, expect, it } from 'vitest'
import {
  createScheduleStore,
  defaultSchedule,
  validateScheduleInput,
  validationErrorMessage,
} from '../backend/src/domain/schedule.js'

describe('валидация недельного расписания', () => {
  it('принимает закрытую неделю (все 7 дней пустые)', () => {
    const errors = validateScheduleInput(defaultSchedule())
    expect(errors).toEqual({})
  })

  it('принимает корректное расписание с одним открытым днём', () => {
    const schedule = {
      days: [
        { dayOfWeek: 1, intervals: [{ start: '09:00', end: '10:00' }] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    expect(validateScheduleInput(schedule)).toEqual({})
  })

  it('принимает день с несколькими интервалами (без пересечений)', () => {
    const schedule = {
      days: [
        {
          dayOfWeek: 3,
          intervals: [
            { start: '09:00', end: '12:00' },
            { start: '13:00', end: '18:00' },
          ],
        },
        { dayOfWeek: 1, intervals: [] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    expect(validateScheduleInput(schedule)).toEqual({})
  })

  it('отклоняет отсутствие days', () => {
    const errors = validateScheduleInput({})
    expect(errors.days).toBeTruthy()
  })

  it('отклоняет 6 дней', () => {
    const schedule = { days: [{ dayOfWeek: 1, intervals: [] }] }
    const errors = validateScheduleInput(schedule)
    expect(errors.days).toContain('ровно 7')
  })

  it('отклоняет 8 дней', () => {
    const schedule = {
      days: Array.from({ length: 8 }, (_, i) => ({
        dayOfWeek: (i % 7) + 1,
        intervals: [],
      })),
    }
    const errors = validateScheduleInput(schedule)
    expect(errors.days).toBeTruthy()
  })

  it('отклоняет повторный dayOfWeek', () => {
    const schedule = {
      days: [
        { dayOfWeek: 1, intervals: [] },
        { dayOfWeek: 1, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    const errors = validateScheduleInput(schedule)
    expect(errors.days).toContain('указан несколько раз')
  })

  it('отклоняет интервал с start == end', () => {
    const schedule = {
      days: [
        { dayOfWeek: 1, intervals: [{ start: '10:00', end: '10:00' }] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    const errors = validateScheduleInput(schedule)
    expect(errors.days).toContain('начинаться раньше конца')
  })

  it('отклоняет интервал с start > end', () => {
    const schedule = {
      days: [
        { dayOfWeek: 5, intervals: [{ start: '18:00', end: '09:00' }] },
        { dayOfWeek: 1, intervals: [] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    const errors = validateScheduleInput(schedule)
    expect(errors.days).toBeTruthy()
  })

  it('отклоняет невалидные временные значения', () => {
    const cases = [
      '24:00',
      '9:00',
      '10:60',
      'ab:cd',
      '25:00',
      '12:99',
    ]
    for (const bad of cases) {
      const schedule = {
        days: [
          { dayOfWeek: 1, intervals: [{ start: bad, end: '17:00' }] },
          { dayOfWeek: 2, intervals: [] },
          { dayOfWeek: 3, intervals: [] },
          { dayOfWeek: 4, intervals: [] },
          { dayOfWeek: 5, intervals: [] },
          { dayOfWeek: 6, intervals: [] },
          { dayOfWeek: 7, intervals: [] },
        ],
      }
      const errors = validateScheduleInput(schedule)
      expect(errors.days, `ожидали 400 на start="${bad}"`).toBeTruthy()
    }
  })

  it('отклоняет невалидное dayOfWeek', () => {
    const schedule = {
      days: [
        { dayOfWeek: 0, intervals: [] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    expect(validateScheduleInput(schedule).days).toBeTruthy()
  })
})

describe('validationErrorMessage расписания', () => {
  it('возвращает текст сообщения', () => {
    expect(
      validationErrorMessage({
        days: 'День недели 1: интервал 10:00–09:00 должен начинаться раньше конца',
      }),
    ).toContain('10:00–09:00')
  })
})

describe('хранилище расписания', () => {
  it('создаёт хранилище с пустым расписанием по умолчанию', () => {
    const store = createScheduleStore()
    const schedule = store.get()
    expect(schedule.days).toHaveLength(7)
    for (const day of schedule.days) {
      expect(day.intervals).toEqual([])
    }
  })

  it('создаёт хранилище с предустановленным расписанием', () => {
    const schedule = {
      days: [
        { dayOfWeek: 1, intervals: [{ start: '09:00', end: '17:00' }] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    const store = createScheduleStore(schedule)
    const got = store.get()
    expect(got.days[0].intervals).toEqual([{ start: '09:00', end: '17:00' }])
  })

  it('get возвращает глубокую копию', () => {
    const store = createScheduleStore()
    const first = store.get()
    const second = store.get()
    first.days[0].intervals.push({ start: '10:00', end: '11:00' })
    expect(second.days[0].intervals).toEqual([])
  })

  it('set сохраняет и нормализует порядок дней', () => {
    const store = createScheduleStore()
    const input = {
      days: [
        { dayOfWeek: 7, intervals: [] },
        { dayOfWeek: 5, intervals: [{ start: '13:00', end: '18:00' }] },
        { dayOfWeek: 1, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
      ],
    }
    const result = store.set(input)
    expect(result.error).toBeUndefined()
    expect(result.schedule.days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(result.schedule.days[4].intervals[0].start).toBe('13:00')
  })

  it('set нормализует порядок интервалов по start', () => {
    const store = createScheduleStore()
    const input = {
      days: [
        {
          dayOfWeek: 1,
          intervals: [
            { start: '14:00', end: '18:00' },
            { start: '09:00', end: '12:00' },
          ],
        },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    const result = store.set(input)
    expect(result.schedule.days[0].intervals[0].start).toBe('09:00')
    expect(result.schedule.days[0].intervals[1].start).toBe('14:00')
  })

  it('set возвращает ошибку для невалидных данных', () => {
    const store = createScheduleStore()
    const result = store.set({
      days: [
        { dayOfWeek: 1, intervals: [{ start: '10:00', end: '09:00' }] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    })
    expect(result.error).toBe('invalid')
    expect(result.message).toContain('начинаться раньше конца')
  })

  it('set делает предыдущее расписание недоступным после замены', () => {
    const store = createScheduleStore()
    const first = store.get()
    const fullSchedule = {
      days: [
        { dayOfWeek: 1, intervals: [{ start: '09:00', end: '12:00' }] },
        { dayOfWeek: 2, intervals: [] },
        { dayOfWeek: 3, intervals: [] },
        { dayOfWeek: 4, intervals: [] },
        { dayOfWeek: 5, intervals: [] },
        { dayOfWeek: 6, intervals: [] },
        { dayOfWeek: 7, intervals: [] },
      ],
    }
    store.set(fullSchedule)
    const second = store.get()
    expect(second.days[0].intervals).toHaveLength(1)
    expect(first.days[0].intervals).toHaveLength(0)
  })
})
