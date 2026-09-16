import Fastify from 'fastify'
import registerRoutes from './src/gen/routes.js'
import { createBookingTypesStore } from './src/domain/bookingTypes.js'
import { createScheduleStore } from './src/domain/schedule.js'

export function buildApp({ bookingTypes, schedule } = {}) {
  const app = Fastify({
    logger: true,
  })

  app.decorate('bookingTypes', bookingTypes ?? createBookingTypesStore())
  app.decorate('schedule', schedule ?? createScheduleStore())

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