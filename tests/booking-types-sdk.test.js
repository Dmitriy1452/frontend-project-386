import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { client } from '../frontend/src/api/generated/client.gen.ts'
import { api } from '../frontend/src/api/client.js'

describe('вертикальный срез: сгенерированный SDK поверх работающего бэкенда', () => {
  const app = buildApp()
  let baseUrl

  beforeAll(async () => {
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address()
    baseUrl = `http://127.0.0.1:${address.port}`
    client.setConfig({ baseUrl })
  })

  afterAll(async () => {
    await app.close()
  })

  it('создаёт, правит и удаляет тип; GET /api/types отражает активный набор', async () => {
    const initial = await api.listBookingTypes()
    expect(initial).toEqual([])

    const created = await api.createBookingType({
      name: 'Обзор',
      description: 'Вводный звонок',
      durationMinutes: 20,
    })
    expect(created).toMatchObject({
      name: 'Обзор',
      description: 'Вводный звонок',
      durationMinutes: 20,
    })
    expect(created.id).toBeTypeOf('string')

    expect(await api.listBookingTypes()).toHaveLength(1)

    const updated = await api.updateBookingType(created.id, {
      durationMinutes: 45,
    })
    expect(updated.name).toBe('Обзор')
    expect(updated.durationMinutes).toBe(45)

    await api.deleteBookingType(created.id)
    expect(await api.listBookingTypes()).toEqual([])
  })
})