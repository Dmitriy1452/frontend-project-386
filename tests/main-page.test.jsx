/** @vitest-environment jsdom */

import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../frontend/src/App.jsx'

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

function getBookingCta() {
  return screen.getAllByRole('link', { name: 'Записаться' })[0]
}

afterEach(cleanup)

describe('главная страница', () => {
  it('знакомит посетителя с сервисом и ведёт на запись', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: 'Календарь звонков' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Запишитесь на звонок в пару кликов'),
    ).toBeTruthy()
    expect(getBookingCta().getAttribute('href')).toBe('/booking')
  })

  it('рассказывает, как записаться на звонок', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: 'Как это работает' }),
    ).toBeTruthy()
    expect(screen.getByText('Выберите удобный слот')).toBeTruthy()
    expect(screen.getByText('Запишитесь на звонок')).toBeTruthy()
    expect(
      screen.getByText('Подключайтесь в назначенное время'),
    ).toBeTruthy()
    expect(screen.getByText('© Календарь звонков')).toBeTruthy()
  })
})

describe('страница записи', () => {
  it('открывается по «Записаться» и возвращает на главную', () => {
    renderApp()

    fireEvent.click(getBookingCta())

    expect(
      screen.getByRole('heading', { name: 'Запись на звонок' }),
    ).toBeTruthy()
    expect(screen.getByText('Здесь появится запись на звонок')).toBeTruthy()

    fireEvent.click(screen.getByRole('link', { name: 'Назад на главную' }))

    expect(
      screen.getByRole('heading', { name: 'Календарь звонков' }),
    ).toBeTruthy()
  })
})