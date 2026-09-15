/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../frontend/src/App.jsx'
import OwnerTypesPage from '../frontend/src/pages/OwnerTypesPage.jsx'
import { ApiError, api } from '../frontend/src/api/client.js'

vi.mock('../frontend/src/api/client.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    api: {
      listBookingTypes: vi.fn(),
      createBookingType: vi.fn(),
      updateBookingType: vi.fn(),
      deleteBookingType: vi.fn(),
    },
  }
})

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/owner/types']}>
        <OwnerTypesPage />
      </MemoryRouter>
    </MantineProvider>,
  )
}

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

async function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип' }))
  await screen.findByTestId('type-name-input')
}

function fillForm(name, duration, description = '') {
  fireEvent.change(screen.getByTestId('type-name-input'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByTestId('type-duration-input'), {
    target: { value: duration },
  })
  fireEvent.change(screen.getByTestId('type-description-input'), {
    target: { value: description },
  })
}

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('секция «Типы звонков»', () => {
  it('показывает заголовок и ошибку загрузки, если сервер недоступен', async () => {
    api.listBookingTypes.mockRejectedValue(new Error('Сеть недоступна'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('owner-types-load-error')).toBeTruthy(),
    )
  })

  it('показывает пустое состояние, когда типов нет', async () => {
    api.listBookingTypes.mockResolvedValue([])
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('owner-types-empty')).toBeTruthy(),
    )
    expect(
      screen.getByRole('heading', { name: 'Типы звонков' }),
    ).toBeTruthy()
  })

  it('отображает список активных типов', async () => {
    api.listBookingTypes.mockResolvedValue([
      {
        id: 't1',
        name: 'Консультация',
        description: 'Знакомство',
        durationMinutes: 30,
      },
      { id: 't2', name: 'Синк', durationMinutes: 15 },
    ])
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('owner-types-table')).toBeTruthy(),
    )
    expect(screen.getByText('Консультация')).toBeTruthy()
    expect(screen.getByText('Знакомство')).toBeTruthy()
    expect(screen.getByText('30 мин')).toBeTruthy()
    expect(screen.getByText('Синк')).toBeTruthy()
    expect(screen.getByText('15 мин')).toBeTruthy()
  })

  it('создаёт тип через мокированный клиент и обновляет список', async () => {
    api.listBookingTypes.mockResolvedValue([])
    const created = {
      id: 't3',
      name: 'Новинка',
      description: '',
      durationMinutes: 25,
    }
    api.createBookingType.mockResolvedValue(created)
    renderPage()

    await waitFor(() => expect(screen.getByTestId('owner-types-empty')).toBeTruthy())

    await openCreateForm()
    fillForm('Новинка', '25')
    api.listBookingTypes.mockResolvedValue([created])
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    await waitFor(() =>
      expect(api.createBookingType).toHaveBeenCalledWith({
        name: 'Новинка',
        description: '',
        durationMinutes: 25,
      }),
    )
    await waitFor(() => expect(screen.getByText('Новинка')).toBeTruthy())
  })

  it('не отправляет запрос при невалидных полях и показывает ошибки', async () => {
    api.listBookingTypes.mockResolvedValue([])
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Создать тип' })).toBeTruthy(),
    )
    await openCreateForm()
    fillForm('   ', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(
      await screen.findByText('Название не может быть пустым'),
    ).toBeTruthy()
    expect(
      screen.getByText('Длительность должна быть положительным целым числом'),
    ).toBeTruthy()
    expect(api.createBookingType).not.toHaveBeenCalled()
  })

  it('показывает ошибку 409 как ошибку поля названия', async () => {
    api.listBookingTypes.mockResolvedValue([])
    api.createBookingType.mockRejectedValue(
      new ApiError(409, 'Тип с названием «Дубль» уже существует'),
    )
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Создать тип' })).toBeTruthy(),
    )
    await openCreateForm()
    fillForm('Дубль', '20')
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(
      await screen.findByText('Тип с названием «Дубль» уже существует'),
    ).toBeTruthy()
  })

  it('показывает ошибку 400 как общую ошибку формы', async () => {
    api.listBookingTypes.mockResolvedValue([])
    api.createBookingType.mockRejectedValue(
      new ApiError(400, 'Длительность не подходит'),
    )
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Создать тип' })).toBeTruthy(),
    )
    await openCreateForm()
    fillForm('Звонок', '30')
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByTestId('owner-types-form-error')).toBeTruthy()
    expect(screen.getByText('Длительность не подходит')).toBeTruthy()
  })

  it('правит тип и отправляет только изменённые поля', async () => {
    const type = {
      id: 't1',
      name: 'Старое',
      description: 'Описание',
      durationMinutes: 20,
    }
    api.listBookingTypes.mockResolvedValue([type])
    api.updateBookingType.mockResolvedValue({ ...type, name: 'Новое' })
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Редактировать' })).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }))

    const nameInput = await screen.findByTestId('type-name-input')
    expect(nameInput.value).toBe('Старое')
    fireEvent.change(nameInput, { target: { value: 'Новое' } })
    api.listBookingTypes.mockResolvedValue([{ ...type, name: 'Новое' }])
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(api.updateBookingType).toHaveBeenCalledWith('t1', {
        name: 'Новое',
      }),
    )
    await waitFor(() => expect(screen.getByText('Новое')).toBeTruthy())
  })

  it('удаляет тип после подтверждения', async () => {
    const type = { id: 't1', name: 'Лишний', durationMinutes: 10 }
    api.listBookingTypes.mockResolvedValue([type])
    api.deleteBookingType.mockResolvedValue({})
    renderPage()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление' }))

    await waitFor(() =>
      expect(api.deleteBookingType).toHaveBeenCalledWith('t1'),
    )
    await waitFor(() =>
      expect(screen.getByTestId('owner-types-empty')).toBeTruthy(),
    )
  })
})

describe('навигация на секцию владельца', () => {
  it('ведёт с главной страницы на маршрут /owner/types', async () => {
    api.listBookingTypes.mockResolvedValue([])
    renderApp()

    fireEvent.click(
      screen.getByRole('link', { name: 'Управление владельца: типы звонков' }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Типы звонков' }),
      ).toBeTruthy(),
    )
    expect(screen.getByTestId('owner-types-empty')).toBeTruthy()
  })
})