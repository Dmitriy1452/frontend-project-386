import Fastify from 'fastify'
import registerRoutes from './src/gen/routes.js'
import { createBookingsStore } from './src/domain/bookings.js'
import { createBookingTypesStore } from './src/domain/bookingTypes.js'
import { createScheduleStore } from './src/domain/schedule.js'
import { resolveNow } from './src/domain/time.js'

export function buildApp({ bookingTypes, schedule, bookings, now } = {}) {
  const app = Fastify({
    logger: true,
  })

  const typesStore = bookingTypes ?? createBookingTypesStore()
  const scheduleStore = schedule ?? createScheduleStore()
  const bookingsStore =
    bookings ?? createBookingsStore({ bookingTypes: typesStore, schedule: scheduleStore, now })

  app.decorate('bookingTypes', typesStore)
  app.decorate('schedule', scheduleStore)
  app.decorate('bookings', bookingsStore)
  app.decorate('now', () => resolveNow(now))

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ message: error.message })
    }
    reply.send(error)
  })

  app.register(registerRoutes)

  app.get('/api/health', async () => {
    return {
      status: 'ok',
    }
  })

  return app
}