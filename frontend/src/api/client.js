import {
  createBookingType,
  deleteBookingType,
  listBookingTypes,
  updateBookingType,
} from './generated/index.ts'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function unwrap(result) {
  const { data, error, response } = await result
  if (error) {
    throw new ApiError(
      response?.status ?? 0,
      typeof error === 'object' && error !== null && 'message' in error
        ? error.message
        : 'Не удалось выполнить запрос',
    )
  }
  return data
}

export const api = {
  listBookingTypes() {
    return unwrap(listBookingTypes())
  },

  createBookingType(body) {
    return unwrap(createBookingType({ body }))
  },

  updateBookingType(id, body) {
    return unwrap(updateBookingType({ path: { id }, body }))
  },

  deleteBookingType(id) {
    return unwrap(deleteBookingType({ path: { id } }))
  },
}
