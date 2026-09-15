import {
  validateBookingTypeInput,
  validationErrorMessage,
} from '../domain/bookingTypes.js'

function notImplemented(name) {
  return async () => {
    throw new Error(`Handler "${name}" ещё не реализован (тикеты #12–#20)`)
  }
}

function storeOf(request) {
  return request.server.bookingTypes
}

function duplicateTypeNameMessage(name) {
  return `Тип с названием «${name}» уже существует`
}

function notFoundMessage() {
  return 'Тип звонка не найден'
}

export const handlers = {
  listBookingTypes: async (request) => storeOf(request).list(),

  createBookingType: async (request, reply) => {
    const { name, description, durationMinutes } = request.body ?? {}
    const trimmedName = name?.trim() ?? ''
    const errors = validateBookingTypeInput({
      name: trimmedName,
      durationMinutes,
    })
    if (Object.keys(errors).length > 0) {
      return reply.code(400).send({ message: validationErrorMessage(errors) })
    }
    const result = storeOf(request).create({
      name: trimmedName,
      description,
      durationMinutes,
    })
    if (result.error === 'duplicate') {
      return reply.code(409).send({ message: duplicateTypeNameMessage(trimmedName) })
    }
    return reply.code(201).send(result.type)
  },

  updateBookingType: async (request, reply) => {
    const { id } = request.params
    const body = request.body ?? {}
    const patch = { ...body }
    if (patch.name !== undefined) {
      patch.name = typeof patch.name === 'string' ? patch.name.trim() : ''
    }
    const errors = validateBookingTypeInput(patch)
    if (Object.keys(errors).length > 0) {
      return reply.code(400).send({ message: validationErrorMessage(errors) })
    }
    const result = storeOf(request).update(id, patch)
    if (result.error === 'notFound') {
      return reply.code(404).send({ message: notFoundMessage() })
    }
    if (result.error === 'duplicate') {
      return reply.code(409).send({ message: duplicateTypeNameMessage(patch.name) })
    }
    return reply.code(200).send(result.type)
  },

  deleteBookingType: async (request, reply) => {
    const { id } = request.params
    const result = storeOf(request).remove(id)
    if (result.error === 'notFound') {
      return reply.code(404).send({ message: notFoundMessage() })
    }
    return reply.code(204).send()
  },

  listSlots: notImplemented('listSlots'),
  createBooking: notImplemented('createBooking'),
  getSchedule: notImplemented('getSchedule'),
  putSchedule: notImplemented('putSchedule'),
  getCalendarWeek: notImplemented('getCalendarWeek'),
  listBookings: notImplemented('listBookings'),
  cancelBooking: notImplemented('cancelBooking'),
}