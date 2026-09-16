/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OwnerSchedulePage from '../frontend/src/pages/OwnerSchedulePage.jsx'
import { api } from '../frontend/src/api/client.js'

vi.mock('../frontend/src/api/client.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    api: {
      getSchedule: vi.fn(),
      putSchedule: vi.fn(),
      getCalendarWeek: vi.fn(),
    },
  }
})

const WEEK_START = '2026-09-21'

function week() {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals:
        index === 0
          ? [{ start: '09:00', end: '12:00' }]
          : index === 1
            ? [{ start: '09:00', end: '10:00' }]
            : [],
    })),
  }
}

function timeOf(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function bookingFrom(minutes, duration, { name, status = 'active', typeName = 'Консультация' }) {
  return {
    id: `${name}-${minutes}-${status}`,
    type: { id: 't1', name: typeName, durationMinutes: duration },
    start: `2026-09-21T${timeOf(minutes)}:00`,
    end: `2026-09-21T${timeOf(minutes + duration)}:00`,
    name,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@example.com`,
    status,
  }
}

function activeBooking(minutes) {
  return bookingFrom(minutes, 30, { name: 'Иван Петров' })
}

function cancelledBooking(minutes) {
  return bookingFrom(minutes, 30, {
    name: 'Анна Смирнова',
    status: 'cancelled',
  })
}

function calendar({ schedule = week(), bookings = [] } = {}) {
  return { weekStart: WEEK_START, schedule, bookings }
}

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/owner/schedule']}>
        <OwnerSchedulePage now={new Date('2026-09-21T10:00:00')} />
      </MemoryRouter>
    </MantineProvider>,
  )
}

beforeEach(() => {
  api.getSchedule.mockResolvedValue(week())
})

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('недельная сетка владельца на странице «Календарь»', () => {
  it('показывает легенду и ячейки трёх состояний', async () => {
    api.getCalendarWeek.mockResolvedValue(
      calendar({ bookings: [activeBooking(600)] }),
    )
    renderPage()

    expect(
      await screen.findByText('Открыто и свободно'),
    ).toBeTruthy()
    expect(screen.getByText('Открыто и занято')).toBeTruthy()
    expect(screen.getByText('Закрыто')).toBeTruthy()

    await waitFor(() =>
      expect(screen.getByTestId('calendar-cell-1-600').dataset.state).toBe(
        'occupied',
      ),
    )
    expect(screen.getByTestId('calendar-cell-1-540').dataset.state).toBe('open')
    expect(screen.getByTestId('calendar-cell-7-540').dataset.state).toBe('closed')
  })

  it('на занятом времени показывает имя посетителя и тип звонка', async () => {
    api.getCalendarWeek.mockResolvedValue(
      calendar({ bookings: [activeBooking(600)] }),
    )
    renderPage()

    await screen.findByTestId('calendar-week-grid')
    const cell = screen.getByTestId('calendar-cell-1-600')
    expect(cell.textContent).toContain('Иван Петров')
    expect(cell.textContent).toContain('Консультация')
  })

  it('отменённая запись не блокирует время и не отображается как занятость', async () => {
    api.getCalendarWeek.mockResolvedValue(
      calendar({
        bookings: [activeBooking(600), cancelledBooking(660)],
      }),
    )
    renderPage()

    await screen.findByTestId('calendar-week-grid')
    const freedCell = screen.getByTestId('calendar-cell-1-660')
    expect(freedCell.dataset.state).toBe('open')
    expect(freedCell.textContent).not.toContain('Анна Смирнова')
    expect(screen.queryByTestId('calendar-visitor-1-660')).toBeNull()
  })

  it('показывает дни недели понедельник–воскресенье с датами', async () => {
    api.getCalendarWeek.mockResolvedValue(calendar({ bookings: [] }))
    renderPage()

    await screen.findByTestId('calendar-week-grid')
    expect(screen.getByTestId('calendar-day-1').textContent).toContain(
      'Понедельник 21.09.2026',
    )
    expect(screen.getByTestId('calendar-day-7').textContent).toContain(
      'Воскресенье 27.09.2026',
    )
  })

  it('запрашивает календарь текущей недели владельца через SDK', async () => {
    api.getCalendarWeek.mockResolvedValue(calendar())
    renderPage()

    await waitFor(() =>
      expect(api.getCalendarWeek).toHaveBeenCalledWith(WEEK_START),
    )
  })

  it('правка и сохранение расписания сохраняют записи и отражаются на сетке', async () => {
    const schedule = week()
    api.getCalendarWeek.mockResolvedValue(
      calendar({ schedule, bookings: [activeBooking(600)] }),
    )
    api.putSchedule.mockImplementation(async (value) => value)
    renderPage()

    await screen.findByTestId('calendar-week-grid')
    expect(screen.getByTestId('calendar-cell-1-600').dataset.state).toBe(
      'occupied',
    )
    expect(screen.getByTestId('calendar-cell-2-540').dataset.state).toBe('open')

    fireEvent.click(screen.getByRole('switch', { name: 'Вторник' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить расписание' }))

    await waitFor(() =>
      expect(screen.getByTestId('calendar-cell-2-540').dataset.state).toBe(
        'closed',
      ),
    )
    expect(screen.getByTestId('calendar-cell-1-600').dataset.state).toBe(
      'occupied',
    )
    expect(screen.getByTestId('calendar-cell-1-600').textContent).toContain(
      'Иван Петров',
    )
  })

  it('при пустой неделе показывает сообщение вместо сетки', async () => {
    const closed = {
      days: Array.from({ length: 7 }, (_, index) => ({
        dayOfWeek: index + 1,
        intervals: [],
      })),
    }
    api.getSchedule.mockResolvedValue(closed)
    api.getCalendarWeek.mockResolvedValue(calendar({ schedule: closed }))
    renderPage()

    expect(
      await screen.findByTestId('calendar-week-empty'),
    ).toBeTruthy()
    expect(screen.queryByTestId('calendar-week-grid')).toBeNull()
  })
})