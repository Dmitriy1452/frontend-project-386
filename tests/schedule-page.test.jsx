/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../frontend/src/App.jsx'
import OwnerSchedulePage from '../frontend/src/pages/OwnerSchedulePage.jsx'
import { api } from '../frontend/src/api/client.js'

vi.mock('../frontend/src/api/client.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    api: {
      getSchedule: vi.fn(),
      putSchedule: vi.fn(),
    },
  }
})

function closedWeek() {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals: [],
    })),
  }
}

function withMondayOpen(week = closedWeek()) {
  return {
    ...week,
    days: week.days.map((day) =>
      day.dayOfWeek === 1
        ? { ...day, intervals: [{ start: '09:00', end: '10:00' }] }
        : day,
    ),
  }
}

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/owner/schedule']}>
        <OwnerSchedulePage />
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

async function awaitSchedule() {
  await screen.findByRole('switch', { name: 'Понедельник' })
  return screen.getByRole('switch', { name: 'Понедельник' })
}

afterEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('страница «Календарь»', () => {
  it('показывает заголовок и ошибку загрузки, если сервер недоступен', async () => {
    api.getSchedule.mockRejectedValue(new Error('Сеть недоступна'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId('schedule-load-error')).toBeTruthy(),
    )
    expect(screen.getByText('Сеть недоступна')).toBeTruthy()
  })

  it('показывает закрытую неделю по умолчанию', async () => {
    api.getSchedule.mockResolvedValue(closedWeek())
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'Календарь' }),
    ).toBeTruthy()
    await awaitSchedule()
    for (const day of ['Понедельник', 'Среда', 'Воскресенье']) {
      expect(screen.getByRole('switch', { name: day })).toBeTruthy()
    }
    await waitFor(() =>
      expect(screen.getByTestId('day-status-1').textContent).toBe('Закрыт'),
    )
    expect(screen.queryByTestId('interval-start-1-0')).toBeNull()
  })

  it('отображает открытый день с интервалами из сохранённого расписания', async () => {
    const week = withMondayOpen()
    week.days[0].intervals = [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ]
    api.getSchedule.mockResolvedValue(week)
    renderPage()

    const mondayCheckbox = await awaitSchedule()
    expect(mondayCheckbox.checked).toBe(true)
    expect(screen.getByTestId('day-status-1').textContent).toBe('Открыт')
    expect(screen.getByTestId('interval-start-1-0').value).toBe('09:00')
    expect(screen.getByTestId('interval-end-1-0').value).toBe('12:00')
    expect(screen.getByTestId('interval-start-1-1').value).toBe('14:00')
    expect(screen.getByTestId('day-status-2').textContent).toBe('Закрыт')
  })

  it('открывает закрытый день и добавляет интервал по умолчанию', async () => {
    api.getSchedule.mockResolvedValue(closedWeek())
    renderPage()

    const mondayCheckbox = await awaitSchedule()
    expect(mondayCheckbox.checked).toBe(false)

    fireEvent.click(mondayCheckbox)

    await waitFor(() =>
      expect(screen.getByTestId('day-status-1').textContent).toBe('Открыт'),
    )
    expect(screen.getByTestId('interval-start-1-0').value).toBe('09:00')
    expect(screen.getByTestId('interval-end-1-0').value).toBe('10:00')
  })

  it('закрытие дня убирает его интервалы', async () => {
    const week = withMondayOpen()
    api.getSchedule.mockResolvedValue(week)
    renderPage()

    const mondayCheckbox = await awaitSchedule()
    expect(mondayCheckbox.checked).toBe(true)

    fireEvent.click(mondayCheckbox)

    await waitFor(() =>
      expect(screen.getByTestId('day-status-1').textContent).toBe('Закрыт'),
    )
    expect(screen.queryByTestId('interval-start-1-0')).toBeNull()
  })

  it('добавляет, правит и удаляет интервалы дня', async () => {
    api.getSchedule.mockResolvedValue(withMondayOpen())
    renderPage()

    await awaitSchedule()
    fireEvent.click(screen.getByTestId('interval-add-1'))
    expect(screen.getByTestId('interval-start-1-1')).toBeTruthy()

    fireEvent.change(screen.getByTestId('interval-start-1-1'), {
      target: { value: '13:00' },
    })
    fireEvent.change(screen.getByTestId('interval-end-1-1'), {
      target: { value: '14:00' },
    })
    expect(screen.getByTestId('interval-start-1-1').value).toBe('13:00')

    fireEvent.click(screen.getByTestId('interval-remove-1-0'))

    await waitFor(() =>
      expect(screen.queryByTestId('interval-start-1-1')).toBeNull(),
    )
    expect(screen.getByTestId('interval-start-1-0').value).toBe('13:00')
    expect(screen.getByTestId('interval-end-1-0').value).toBe('14:00')
  })

  it('сохраняет полное недельное расписание через PUT', async () => {
    api.getSchedule.mockResolvedValue(closedWeek())
    api.putSchedule.mockResolvedValue(withMondayOpen())
    renderPage()

    const mondayCheckbox = await awaitSchedule()
    fireEvent.click(mondayCheckbox)
    const week = closedWeek()
    week.days[0].intervals = [{ start: '09:00', end: '10:00' }]

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить расписание' }))

    await waitFor(() =>
      expect(api.putSchedule).toHaveBeenCalledWith(week),
    )
    await waitFor(() =>
      expect(screen.getByTestId('schedule-saved')).toBeTruthy(),
    )
  })

  it('показывает ошибку и не сохраняет невалидный интервал', async () => {
    api.getSchedule.mockResolvedValue(withMondayOpen())
    renderPage()

    await awaitSchedule()
    const endInput = screen.getByTestId('interval-end-1-0')
    fireEvent.change(endInput, { target: { value: '09:00' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить расписание' }))

    await waitFor(() =>
      expect(screen.getByTestId('schedule-save-error')).toBeTruthy(),
    )
    expect(api.putSchedule).not.toHaveBeenCalled()
  })

  it('после перезагрузки отображает сохранённое расписание с сервера', async () => {
    api.getSchedule.mockResolvedValue(withMondayOpen(closedWeek()))
    const { unmount } = renderPage()
    await awaitSchedule()

    unmount()
    cleanup()

    api.getSchedule.mockResolvedValue(withMondayOpen(closedWeek()))
    renderPage()

    await awaitSchedule()
    expect(screen.getByTestId('day-status-1').textContent).toBe('Открыт')
    expect(screen.getByTestId('interval-start-1-0').value).toBe('09:00')
  })

  it('показывает сброс статуса сохранения при правке после сохранения', async () => {
    api.getSchedule.mockResolvedValue(closedWeek())
    api.putSchedule.mockResolvedValue(withMondayOpen())
    renderPage()

    await awaitSchedule()
    fireEvent.click(screen.getByRole('switch', { name: 'Понедельник' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить расписание' }))
    await screen.findByTestId('schedule-saved')

    fireEvent.change(screen.getByTestId('interval-end-1-0'), {
      target: { value: '11:00' },
    })
    expect(screen.queryByTestId('schedule-saved')).toBeNull()
  })
})

describe('навигация на страницу «Календарь»', () => {
  it('ведёт с главной страницы на маршрут /owner/schedule', async () => {
    api.getSchedule.mockResolvedValue(closedWeek())
    renderApp()

    fireEvent.click(
      screen.getByRole('link', { name: 'Управление владельца: календарь' }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Календарь' }),
      ).toBeTruthy(),
    )
    expect(screen.getByTestId('day-toggle-1')).toBeTruthy()
  })
})