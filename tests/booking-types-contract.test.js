import { describe, expect, it } from 'vitest'
import { buildApp } from '../backend/app.js'
import { createBookingTypesStore } from '../backend/src/domain/bookingTypes.js'

function makeApp({ types } = {}) {
  const store = createBookingTypesStore()
  for (const type of types ?? []) {
    store.create(type)
  }
  return buildApp({ bookingTypes: store })
}

describe('типы звонков: контракт CRUD (buildApp + inject)', () => {
  it('GET /api/types возвращает пустой список в пустом хранилище', async () => {
    const app = makeApp()
    const response = await app.inject({ method: 'GET', url: '/api/types' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([])
    await app.close()
  })

  it('POST создаёт тип, и он появляется в списке', async () => {
    const app = makeApp()
    const created = await app.inject({
      method: 'POST',
      url: '/api/types',
      payload: { name: 'Консультация', durationMinutes: 30, description: 'Знакомство' },
    })
    expect(created.statusCode).toBe(201)
    const body = created.json()
    expect(body.id).toBeTypeOf('string')
    expect(body).toMatchObject({
      name: 'Консультация',
      description: 'Знакомство',
      durationMinutes: 30,
    })

    const list = await app.inject({ method: 'GET', url: '/api/types' })
    expect(list.json()).toEqual([body])
    await app.close()
  })

  it('GET /api/types отдаёт только активные типы', async () => {
    const app = makeApp({
      types: [
        { name: 'Первый', durationMinutes: 20 },
        { name: 'Второй', durationMinutes: 40 },
      ],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    expect(list.json()).toHaveLength(2)
    await app.close()
  })

  it('POST с дублирующимся названием возвращает 409', async () => {
    const app = makeApp({
      types: [{ name: 'Консультация', durationMinutes: 30 }],
    })
    const response = await app.inject({
      method: 'POST',
      url: '/api/types',
      payload: { name: 'Консультация', durationMinutes: 15 },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().message).toContain('уже существует')
    await app.close()
  })

  it('POST с невалидными данными возвращает 400', async () => {
    const app = makeApp()

    const cases = [
      { payload: { name: '   ', durationMinutes: 20 } },
      { payload: { name: '', durationMinutes: 20 } },
      { payload: { name: 'Звонок', durationMinutes: 0 } },
      { payload: { name: 'Звонок', durationMinutes: -5 } },
      { payload: { name: 'Звонок', durationMinutes: 1.5 } },
      { payload: { name: 'x'.repeat(121), durationMinutes: 20 } },
      { payload: { durationMinutes: 20 } },
      { payload: { name: 'Звонок' } },
    ]

    for (const { payload } of cases) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/types',
        payload,
      })
      expect(response.statusCode, JSON.stringify(payload)).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })

  it('PUT правит название, описание и длительность', async () => {
    const app = makeApp({
      types: [{ name: 'Старое имя', description: 'Старое описание', durationMinutes: 20 }],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    const [type] = list.json()

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/types/${type.id}`,
      payload: { name: 'Новое имя', description: '', durationMinutes: 45 },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toEqual({
      id: type.id,
      name: 'Новое имя',
      description: '',
      durationMinutes: 45,
    })
    await app.close()
  })

  it('PUT применяет только переданные поля', async () => {
    const app = makeApp({
      types: [
        { name: 'Имя', description: 'Описание', durationMinutes: 20 },
      ],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    const [type] = list.json()

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/types/${type.id}`,
      payload: { durationMinutes: 30 },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toEqual({
      id: type.id,
      name: 'Имя',
      description: 'Описание',
      durationMinutes: 30,
    })
    await app.close()
  })

  it('PUT на существующее название другого типа возвращает 409', async () => {
    const app = makeApp({
      types: [
        { name: 'Занятое', durationMinutes: 20 },
        { name: 'Свободное', durationMinutes: 30 },
      ],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    const [, second] = list.json()

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/types/${second.id}`,
      payload: { name: 'Занятое' },
    })
    expect(updated.statusCode).toBe(409)
    await app.close()
  })

  it('PUT несуществующего типа возвращает 404', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/api/types/unknown-id',
      payload: { name: 'Имя', durationMinutes: 20 },
    })
    expect(response.statusCode).toBe(404)
    await app.close()
  })

  it('PUT с невалидными данными возвращает 400', async () => {
    const app = makeApp({
      types: [{ name: 'Имя', durationMinutes: 20 }],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    const [type] = list.json()

    const cases = [
      { payload: { name: '   ' } },
      { payload: { durationMinutes: 0 } },
      { payload: { durationMinutes: -1 } },
      { payload: { name: 'x'.repeat(121) } },
    ]
    for (const { payload } of cases) {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/types/${type.id}`,
        payload,
      })
      expect(response.statusCode, JSON.stringify(payload)).toBe(400)
      expect(response.json().message).toBeTypeOf('string')
    }
    await app.close()
  })

  it('DELETE удаляет тип: список пустеет, название переиспользуемо', async () => {
    const app = makeApp({
      types: [{ name: 'Удаляемый', durationMinutes: 25 }],
    })
    const list = await app.inject({ method: 'GET', url: '/api/types' })
    const [type] = list.json()

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/types/${type.id}`,
    })
    expect(deleted.statusCode).toBe(204)

    const afterDelete = await app.inject({ method: 'GET', url: '/api/types' })
    expect(afterDelete.json()).toEqual([])

    const recreated = await app.inject({
      method: 'POST',
      url: '/api/types',
      payload: { name: 'Удаляемый', durationMinutes: 10 },
    })
    expect(recreated.statusCode).toBe(201)
    await app.close()
  })

  it('DELETE несуществующего типа возвращает 404', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/types/unknown-id',
    })
    expect(response.statusCode).toBe(404)
    await app.close()
  })
})