/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../frontend/src/App.jsx'
import BookingPage from '../frontend/src/pages/BookingPage.jsx'
import { ApiError, api } from '../frontend/src/api/client.js'

vi.mock('../frontend/src/api/client.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    api: {
      listBookingTypes: vi.fn(),
      listSlots: vi.fn(),
      createBooking: vi.fn(),
    },
  }
})

const TYPE = {
  id: 't1',
  name: 'Консультация',
  description: 'Знакомство',
  durationMinutes: 30,
}

const SLOTS = [
  { start: '2030-06-03T09:00:00', end: '2030-06-03T09:30:00' },
  { start: '2030-06-03T10:00:00', end: '2030-06-03T10:30:00' },
]

const CREATED_BOOKING = {
  id: 'b1',
  type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
  start: '2030-06-03T09:00:00',
  end: '2030-06-03T09:30:00',
  name: 'Иван',
  email: 'ivan@example.com',
  comment: 'Тема разговора',
  status: 'active',
}

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/booking']}>
        <BookingPage />
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

async function selectType() {
  fireEvent.click(await screen.findByTestId('booking-type-t1'))
  await screen.findByTestId('booking-slot-2030-06-03T09:00:00')
}

async function selectSlotAndFill() {
  fireEvent.click(screen.getByTestId('booking-slot-2030-06-03T09:00:00'))
  await screen.findByTestId('booking-name-input')
  fireEvent.change(screen.getByTestId('booking-name-input'), {
    target: { value: 'Иван' },
  })
  fireEvent.change(screen.getByTestId('booking-email-input'), {
    target: { value: 'ivan@example.com' },
  })
  fireEvent.change(screen.getByTestId('booking-comment-input'), {
    target: { value: 'Тема разговора' },
  })
}

function submitBooking() {
  fireEvent.click(screen.getByRole('button', { name: 'Записаться' }))
}

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('страница записи: полный путь посетителя', () => {
  it('показывает ошибку загрузки типов, если сервер недоступен', async () => {
    api.listBookingTypes.mockRejectedValue(new Error('Сеть недоступна'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('booking-load-error')).toBeTruthy(),
    )
    expect(screen.getByText('Сеть недоступна')).toBeTruthy()
  })

  it('показывает пустое состояние, когда типов нет', async () => {
    api.listBookingTypes.mockResolvedValue([])
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('booking-types-empty')).toBeTruthy(),
    )
  })

  it('выбор слотов: тип → дата → слоты, в локальном времени владельца', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue(SLOTS)
    renderPage()

    await selectType()

    expect(api.listSlots).toHaveBeenCalledWith(
      't1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    )

    expect(screen.getByTestId('booking-slot-2030-06-03T09:00:00')).toBeTruthy()
    expect(screen.getByText('09:00 – 09:30')).toBeTruthy()
    expect(screen.getByText('10:00 – 10:30')).toBeTruthy()
  })

  it('слот до доступной даты не выводится, пока не выбран', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue([])
    renderPage()

    await screen.findByTestId('booking-type-t1')
    fireEvent.click(screen.getByTestId('booking-type-t1'))

    await waitFor(() =>
      expect(screen.getByTestId('booking-slots-empty')).toBeTruthy(),
    )
  })

  it('заполняет форму и получает подтверждение записи', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue(SLOTS)
    api.createBooking.mockResolvedValue(CREATED_BOOKING)
    renderPage()

    await selectType()
    await selectSlotAndFill()
    submitBooking()

    await waitFor(() =>
      expect(api.createBooking).toHaveBeenCalledWith({
        typeId: 't1',
        start: '2030-06-03T09:00:00',
        name: 'Иван',
        email: 'ivan@example.com',
        comment: 'Тема разговора',
      }),
    )

    expect(await screen.findByTestId('booking-confirmation')).toBeTruthy()
    expect(screen.getByTestId('booking-confirmation-type').textContent).toContain(
      'Консультация',
    )
    expect(
      screen.getByTestId('booking-confirmation-datetime').textContent,
    ).toContain('03.06.2030')
    expect(
      screen.getByTestId('booking-confirmation-datetime').textContent,
    ).toContain('09:00 – 09:30')
    expect(
      screen.getByTestId('booking-confirmation-status').textContent,
    ).toBe('Статус: Подтверждено')
  })

  it('не отправляет запрос при пустых имени/email', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue(SLOTS)
    renderPage()

    await selectType()
    await selectSlotAndFill()

    fireEvent.change(screen.getByTestId('booking-name-input'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByTestId('booking-email-input'), {
      target: { value: '' },
    })
    submitBooking()

    await waitFor(() =>
      expect(screen.getByText('Укажите имя')).toBeTruthy(),
    )
    expect(screen.getByText('Укажите корректный email')).toBeTruthy()
    expect(api.createBooking).not.toHaveBeenCalled()
  })

  it('кнопка «Записаться ещё» возвращает к выбору типа', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue(SLOTS)
    api.createBooking.mockResolvedValue(CREATED_BOOKING)
    renderPage()

    await selectType()
    await selectSlotAndFill()
    submitBooking()
    await screen.findByTestId('booking-confirmation')

    fireEvent.click(screen.getByRole('button', { name: 'Записаться ещё' }))

    await waitFor(() =>
      expect(screen.getByTestId('booking-type-t1')).toBeTruthy(),
    )
  })
})

describe('страница записи: ветка конфликта 409', () => {
  it('объясняет конфликт и обновляет слоты, сохраняя выбранный тип', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValueOnce(SLOTS)
    api.createBooking.mockRejectedValue(
      new ApiError(409, 'Это время уже занято другой записью'),
    )
    renderPage()

    await selectType()
    await selectSlotAndFill()

    const updatedSlots = [SLOTS[1]]
    api.listSlots.mockResolvedValueOnce(updatedSlots)
    submitBooking()

    expect(
      await screen.findByTestId('booking-conflict'),
    ).toBeTruthy()
    expect(
      screen.getByText(/Это время уже занято другой записью/),
    ).toBeTruthy()

    await waitFor(() => expect(api.listSlots).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByTestId('booking-slot-2030-06-03T09:00:00')).toBeNull(),
    )
    expect(screen.getByTestId('booking-slot-2030-06-03T10:00:00')).toBeTruthy()

    expect(screen.getByTestId('booking-type-t1')).toBeTruthy()
  })
})

describe('навигация на страницу записи', () => {
  it('ведёт с главной страницы на маршрут /booking', async () => {
    api.listBookingTypes.mockResolvedValue([TYPE])
    api.listSlots.mockResolvedValue(SLOTS)
    renderApp()

    fireEvent.click(screen.getAllByRole('link', { name: 'Записаться' })[0])

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Запись на звонок' }),
      ).toBeTruthy(),
    )
    expect(screen.getByTestId('booking-type-t1')).toBeTruthy()
  })
})