import {
  validateBookingTypeInput,
  validationErrorMessage,
} from '../domain/bookingTypes.js'
import {
  validateBookingInput,
  validationErrorMessage as bookingValidationMessage,
} from '../domain/bookings.js'
import { generateSlots } from '../domain/slots.js'
import { dayNumber, isValidDate } from '../domain/time.js'

function notImplemented(name) {
  return async () => {
    throw new Error(`Handler "${name}" ещё не реализован (тикеты #12–#20)`)
  }
}

function storeOf(request) {
  return request.server.bookingTypes
}

function scheduleStoreOf(request) {
  return request.server.schedule
}

function bookingsStoreOf(request) {
  return request.server.bookings
}

function nowOf(request) {
  return request.server.now()
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

  listSlots: async (request, reply) => {
    const { typeId } = request.params
    const { from, to } = request.query ?? {}
    const type = storeOf(request).list().find((item) => item.id === typeId)
    if (!type) {
      return reply.code(400).send({ message: 'Тип звонка не найден' })
    }
    if (!isValidDate(from) || !isValidDate(to)) {
      return reply
        .code(400)
        .send({ message: 'Даты должны быть в формате YYYY-MM-DD' })
    }
    if (dayNumber(from) > dayNumber(to)) {
      return reply
        .code(400)
        .send({ message: 'Дата начала не может быть позже даты конца' })
    }
    const slots = generateSlots({
      schedule: scheduleStoreOf(request).get(),
      bookings: bookingsStoreOf(request).list(),
      type,
      from,
      to,
      now: nowOf(request),
    })
    return reply.send(slots)
  },

  createBooking: async (request, reply) => {
    const body = request.body ?? {}
    const input = {
      typeId: body.typeId,
      start: body.start,
      name: typeof body.name === 'string' ? body.name.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      comment: body.comment,
    }
    if (body.comment !== undefined && typeof body.comment !== 'string') {
      return reply.code(400).send({ message: 'Комментарий должен быть строкой' })
    }
    const errors = validateBookingInput(input)
    if (Object.keys(errors).length > 0) {
      return reply.code(400).send({ message: bookingValidationMessage(errors) })
    }
    const result = bookingsStoreOf(request).create(input)
    if (result.error === 'notFound') {
      return reply.code(400).send({ message: 'Тип звонка не найден' })
    }
    if (result.error === 'conflict') {
      return reply.code(409).send({ message: result.message })
    }
    return reply.code(201).send(result.booking)
  },

  getSchedule: async (request) => scheduleStoreOf(request).get(),

  putSchedule: async (request, reply) => {
    const result = scheduleStoreOf(request).set(request.body ?? {})
    if (result.error === 'invalid') {
      return reply.code(400).send({ message: result.message })
    }
    return reply.send(result.schedule)
  },

  getCalendarWeek: notImplemented('getCalendarWeek'),

  listBookings: async (request, reply) => {
    const { scope, cursor, limit } = request.query ?? {}
    const result = bookingsStoreOf(request).page({ scope, cursor, limit })
    if (result.error === 'invalid') {
      return reply.code(400).send({ message: result.message })
    }
    return reply.send(result)
  },

  cancelBooking: async (request, reply) => {
    const { id } = request.params
    const result = bookingsStoreOf(request).cancel(id)
    if (result.error === 'notFound') {
      return reply.code(404).send({ message: 'Запись не найдена' })
    }
    if (result.error === 'alreadyCancelled') {
      return reply.code(409).send({ message: 'Запись уже отменена' })
    }
    return reply.send(result.booking)
  },
}