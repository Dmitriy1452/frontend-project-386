import { describe, expect, it } from 'vitest'
import {
  createBookingTypesStore,
  validateBookingTypeInput,
  validationErrorMessage,
} from '../backend/src/domain/bookingTypes.js'

describe('валидация типа звонка', () => {
  it('принимает корректные название и длительность', () => {
    const errors = validateBookingTypeInput({
      name: 'Консультация',
      durationMinutes: 30,
    })
    expect(errors).toEqual({})
  })

  it('принимает длительность без кратности 15 минутам', () => {
    const errors = validateBookingTypeInput({
      name: 'Звонок',
      durationMinutes: 20,
    })
    expect(errors).toEqual({})
  })

  it('отклоняет пустое название', () => {
    expect(validateBookingTypeInput({ name: '', durationMinutes: 30 }).name).toBeTruthy()
    expect(validateBookingTypeInput({ name: '   ', durationMinutes: 30 }).name).toBeTruthy()
    expect(validateBookingTypeInput({ name: undefined, durationMinutes: 30 })).toEqual({})
  })

  it('отклоняет название длиннее 120 символов', () => {
    const errors = validateBookingTypeInput({
      name: 'x'.repeat(121),
      durationMinutes: 30,
    })
    expect(errors.name).toBeTruthy()
  })

  it('отклоняет неположительную длительность', () => {
    for (const durationMinutes of [0, -1, 1.5, '30', NaN]) {
      const errors = validateBookingTypeInput({ name: 'Звонок', durationMinutes })
      expect(errors.durationMinutes, String(durationMinutes)).toBeTruthy()
    }
  })

  it('в частичном обновлении проверяет только переданные поля', () => {
    expect(validateBookingTypeInput({ durationMinutes: 30 })).toEqual({})
    expect(validateBookingTypeInput({ name: '   ' })).not.toEqual({})
  })

  it('validationErrorMessage объединяет сообщения полей', () => {
    const message = validationErrorMessage({
      name: 'Название не может быть пустым',
      durationMinutes: 'Длительность должна быть положительным целым числом',
    })
    expect(message).toContain('Название не может быть пустым')
    expect(message).toContain('Длительность')
  })
})

describe('хранилище типов звонков', () => {
  it('создаёт тип с уникальным id', () => {
    const store = createBookingTypesStore()
    const { type } = store.create({ name: 'Звонок', durationMinutes: 20 })
    expect(type.id).toBeTypeOf('string')
    expect(store.list()).toEqual([type])
  })

  it('отклоняет дубликат названия среди активных', () => {
    const store = createBookingTypesStore()
    store.create({ name: 'Звонок', durationMinutes: 20 })
    const result = store.create({ name: 'Звонок', durationMinutes: 30 })
    expect(result).toEqual({ error: 'duplicate' })
    expect(store.list()).toHaveLength(1)
  })

  it('обновляет только переданные поля', () => {
    const store = createBookingTypesStore()
    const { type } = store.create({
      name: 'Звонок',
      description: 'Описание',
      durationMinutes: 20,
    })
    const { type: updated } = store.update(type.id, { durationMinutes: 45 })
    expect(updated).toEqual({ ...type, durationMinutes: 45 })
  })

  it('при правке держит название уникальным среди остальных', () => {
    const store = createBookingTypesStore()
    store.create({ name: 'Первый', durationMinutes: 20 })
    const { type: second } = store.create({ name: 'Второй', durationMinutes: 20 })
    expect(store.update(second.id, { name: 'Первый' })).toEqual({
      error: 'duplicate',
    })
  })

  it('удаляет тип и делает название переиспользуемым', () => {
    const store = createBookingTypesStore()
    const { type } = store.create({ name: 'Звонок', durationMinutes: 20 })
    expect(store.remove(type.id)).toEqual({ ok: true })
    expect(store.list()).toEqual([])
    expect(store.create({ name: 'Звонок', durationMinutes: 10 })).toMatchObject({
      type: { name: 'Звонок' },
    })
  })

  it('возвращает ошибки notFound для неизвестных id', () => {
    const store = createBookingTypesStore()
    expect(store.update('nope', { durationMinutes: 30 })).toEqual({ error: 'notFound' })
    expect(store.remove('nope')).toEqual({ error: 'notFound' })
  })
})