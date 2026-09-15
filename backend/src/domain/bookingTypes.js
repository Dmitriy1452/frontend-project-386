import { randomUUID } from 'node:crypto'

const MAX_NAME_LENGTH = 120

export function validateBookingTypeInput(input = {}) {
  const errors = {}
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (name === '') {
      errors.name = 'Название не может быть пустым'
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.name = 'Название слишком длинное'
    }
  }
  if (input.durationMinutes !== undefined) {
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
      errors.durationMinutes =
        'Длительность должна быть положительным целым числом'
    }
  }
  return errors
}

export function validationErrorMessage(errors) {
  return Object.values(errors).join('; ')
}

export function createBookingTypesStore() {
  const types = []

  function list() {
    return [...types]
  }

  function nameIsUsed(name, excludeId) {
    return types.some((type) => type.id !== excludeId && type.name === name)
  }

  function create({ name, description, durationMinutes }) {
    if (nameIsUsed(name)) {
      return { error: 'duplicate' }
    }
    const type = { id: randomUUID(), name, description, durationMinutes }
    types.push(type)
    return { type }
  }

  function update(id, patch) {
    const index = types.findIndex((type) => type.id === id)
    if (index === -1) {
      return { error: 'notFound' }
    }
    const current = types[index]
    const next = { ...current, ...patch }
    if (nameIsUsed(next.name, id)) {
      return { error: 'duplicate' }
    }
    types[index] = next
    return { type: next }
  }

  function remove(id) {
    const index = types.findIndex((type) => type.id === id)
    if (index === -1) {
      return { error: 'notFound' }
    }
    types.splice(index, 1)
    return { ok: true }
  }

  return { list, create, update, remove }
}
