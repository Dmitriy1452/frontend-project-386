/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../frontend/src/App.jsx'
import OwnerBookingsPage from '../frontend/src/pages/OwnerBookingsPage.jsx'
import { api } from '../frontend/src/api/client.js'

vi.mock('../frontend/src/api/client.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    api: {
      listBookings: vi.fn(),
      cancelBooking: vi.fn(),
    },
  }
})

const futureBookings = [
  {
    id: 'f1',
    type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
    start: '2026-09-21T09:00:00',
    end: '2026-09-21T09:30:00',
    name: 'Максим',
    email: 'maksim@example.com',
    comment: 'Хочу обсудить проект',
    status: 'active',
  },
  {
    id: 'f2',
    type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
    start: '2026-09-21T11:00:00',
    end: '2026-09-21T11:30:00',
    name: 'Ольга',
    email: 'olga@example.com',
    status: 'active',
  },
  {
    id: 'f3',
    type: { id: 't2', name: 'Разбор', durationMinutes: 60 },
    start: '2026-09-23T09:00:00',
    end: '2026-09-23T10:00:00',
    name: 'Дмитрий',
    email: 'dmitriy@example.com',
    status: 'active',
  },
]

const pastPageOne = [
  {
    id: 'p1',
    type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
    start: '2026-09-16T10:00:00',
    end: '2026-09-16T10:30:00',
    name: 'Анна',
    email: 'anna@example.com',
    comment: 'Вопрос по проекту',
    status: 'active',
  },
  {
    id: 'p2',
    type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
    start: '2026-09-16T09:00:00',
    end: '2026-09-16T09:30:00',
    name: 'Пётр',
    email: 'petr@example.com',
    status: 'active',
  },
  {
    id: 'p3',
    type: { id: 't2', name: 'Разбор', durationMinutes: 60 },
    start: '2026-09-14T11:00:00',
    end: '2026-09-14T12:00:00',
    name: 'Ирина',
    email: 'irina@example.com',
    status: 'active',
  },
]

const pastPageTwo = [
  {
    id: 'p4',
    type: { id: 't1', name: 'Консультация', durationMinutes: 30 },
    start: '2026-09-10T09:00:00',
    end: '2026-09-10T09:30:00',
    name: 'Егор',
    email: 'egor@example.com',
    status: 'active',
  },
]

function mockPagedBookings() {
  let showMoreCalls = 0
  api.listBookings.mockImplementation((scope, cursor) => {
    if (scope === 'future') {
      return Promise.resolve({ items: futureBookings, nextCursor: undefined })
    }
    if (cursor === undefined || cursor === null) {
      return Promise.resolve({ items: pastPageOne, nextCursor: 'cursor-2' })
    }
    showMoreCalls += 1
    return Promise.resolve({ items: pastPageTwo, nextCursor: undefined })
  })
  return {
    showMoreCalls: () => showMoreCalls,
  }
}

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/owner/bookings']}>
        <OwnerBookingsPage />
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

async function awaitLoaded() {
  await screen.findByTestId('owner-bookings-future')
  await screen.findByTestId('owner-bookings-past')
}

function groupIds(sectionTestId) {
  const section = screen.getByTestId(sectionTestId)
  return Array.from(section.querySelectorAll('[data-testid^="owner-bookings-group-"]')).map(
    (element) => element.dataset.testid,
  )
}

function rowIds(group) {
  return Array.from(group.querySelectorAll('[data-testid^="booking-row-"]')).map(
    (element) => element.dataset.testid,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('страница владельца «Звонки»', () => {
  it('показывает заголовок и ошибку загрузки, если сервер недоступен', async () => {
    api.listBookings.mockRejectedValue(new Error('Сеть недоступна'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('owner-bookings-load-error')).toBeTruthy(),
    )
    expect(screen.getByText('Сеть недоступна')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Звонки' })).toBeTruthy()
  })

  it('показывает будущие группы по возрастанию и прошедшие по убыванию', async () => {
    mockPagedBookings()
    renderPage()
    await awaitLoaded()

    expect(groupIds('owner-bookings-future')).toEqual([
      'owner-bookings-group-2026-09-21',
      'owner-bookings-group-2026-09-23',
    ])
    expect(groupIds('owner-bookings-past')).toEqual([
      'owner-bookings-group-2026-09-16',
      'owner-bookings-group-2026-09-14',
    ])

    const future21 = screen.getByTestId('owner-bookings-group-2026-09-21')
    expect(rowIds(future21)).toEqual(['booking-row-f1', 'booking-row-f2'])

    const past16 = screen.getByTestId('owner-bookings-group-2026-09-16')
    expect(rowIds(past16)).toEqual(['booking-row-p1', 'booking-row-p2'])

    expect(screen.getAllByText('Консультация').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Разбор').length).toBeGreaterThan(0)
    expect(screen.getByText('Максим · 09:00 – 09:30')).toBeTruthy()
    expect(screen.getByTestId('booking-status-f1').textContent).toBe('Активен')
  })

  it('разворачивает строку и показывает email и комментарий', async () => {
    mockPagedBookings()
    renderPage()
    await awaitLoaded()

    fireEvent.click(screen.getByTestId('booking-expand-f1'))
    await waitFor(() =>
      expect(screen.getByTestId('booking-details-f1')).toBeTruthy(),
    )
    const f1Details = within(screen.getByTestId('booking-details-f1'))
    expect(f1Details.getByText('Email: maksim@example.com')).toBeTruthy()
    expect(f1Details.getByText('Комментарий: Хочу обсудить проект')).toBeTruthy()

    fireEvent.click(screen.getByTestId('booking-expand-p2'))
    await waitFor(() =>
      expect(screen.getByTestId('booking-details-p2')).toBeTruthy(),
    )
    const p2Details = within(screen.getByTestId('booking-details-p2'))
    expect(p2Details.getByText('Email: petr@example.com')).toBeTruthy()
    expect(p2Details.getByText('Комментарий: нет')).toBeTruthy()

    fireEvent.click(screen.getByTestId('booking-expand-f1'))
    await waitFor(() =>
      expect(screen.queryByTestId('booking-details-f1')).toBeNull(),
    )
  })

  it('«показать ещё» догружает следующую страницу прошедших', async () => {
    mockPagedBookings()
    renderPage()
    await awaitLoaded()

    expect(screen.getByTestId('owner-bookings-group-2026-09-14')).toBeTruthy()
    expect(screen.queryByText('Егор · 09:00 – 09:30')).toBeNull()

    fireEvent.click(screen.getByTestId('owner-bookings-show-more'))

    await waitFor(() =>
      expect(screen.getByText('Егор · 09:00 – 09:30')).toBeTruthy(),
    )
    expect(screen.getByTestId('owner-bookings-group-2026-09-10')).toBeTruthy()
    expect(screen.queryByTestId('owner-bookings-show-more')).toBeNull()
    expect(api.listBookings).toHaveBeenCalledWith('past', 'cursor-2', 5)
  })

  it('отменяет активную встречу: статус «Отменён», строка остаётся в группе', async () => {
    mockPagedBookings()
    api.cancelBooking.mockResolvedValue({
      ...futureBookings[0],
      status: 'cancelled',
    })
    renderPage()
    await awaitLoaded()

    fireEvent.click(screen.getByTestId('booking-cancel-f1'))

    await waitFor(() =>
      expect(api.cancelBooking).toHaveBeenCalledWith('f1'),
    )
    await waitFor(() =>
      expect(screen.getByTestId('booking-status-f1').textContent).toBe('Отменён'),
    )
    expect(screen.queryByTestId('booking-cancel-f1')).toBeNull()
    expect(screen.getByTestId('booking-row-f1')).toBeTruthy()
    expect(screen.getByTestId('booking-status-f2').textContent).toBe('Активен')
    expect(screen.getByTestId('booking-cancel-f2')).toBeTruthy()
  })

  it('показывает ошибку, если отмена не удалась', async () => {
    mockPagedBookings()
    api.cancelBooking.mockRejectedValue(new Error('Запись уже отменена'))
    renderPage()
    await awaitLoaded()

    fireEvent.click(screen.getByTestId('booking-cancel-f1'))

    await waitFor(() =>
      expect(screen.getByTestId('owner-bookings-cancel-error')).toBeTruthy(),
    )
    expect(screen.getByText('Запись уже отменена')).toBeTruthy()
    expect(screen.getByTestId('booking-status-f1').textContent).toBe('Активен')
  })

  it('показывает пустые состояния, когда звонков нет', async () => {
    api.listBookings.mockImplementation(() =>
      Promise.resolve({ items: [], nextCursor: undefined }),
    )
    renderPage()
    await screen.findByTestId('owner-bookings-future-empty')
    expect(screen.getByTestId('owner-bookings-past-empty')).toBeTruthy()
    expect(screen.getByText('Будущих звонков нет')).toBeTruthy()
    expect(screen.getByText('Прошедших звонков нет')).toBeTruthy()
  })
})

describe('навигация на страницу «Звонки»', () => {
  it('ведёт с главной страницы на маршрут /owner/bookings', async () => {
    api.listBookings.mockImplementation(() =>
      Promise.resolve({ items: [], nextCursor: undefined }),
    )
    renderApp()

    fireEvent.click(
      screen.getByRole('link', { name: 'Управление владельца: звонки' }),
    )

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Звонки' })).toBeTruthy(),
    )
    expect(screen.getByTestId('owner-bookings-future-empty')).toBeTruthy()
    expect(within(screen.getByTestId('owner-bookings-past')).getByText('Прошедших звонков нет')).toBeTruthy()
  })
})