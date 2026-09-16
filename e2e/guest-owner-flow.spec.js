import { test, expect } from '@playwright/test'

const BACKEND_URL = 'http://127.0.0.1:3000'

function pad2(value) {
  return String(value).padStart(2, '0')
}

function localDate(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

function dayOfWeek(date) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, month - 1, day).getDay()
  return value === 0 ? 7 : value
}

function timeOf(dateTime) {
  return dateTime.slice(11, 16)
}

function formatDateLong(date) {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function slotTestId(start) {
  return `booking-slot-${start}`
}

function scheduleFor(today) {
  const closedDay = dayOfWeek(today) === 7 ? 6 : 7
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index + 1,
      intervals:
        index + 1 === closedDay
          ? []
          : [{ start: '09:00', end: '18:00' }],
    })),
  }
}

test('guest booking, slot conflicts, owner calendar and cancellation', async ({
  page,
  request,
}) => {
  const today = localDate()
  const suffix = Date.now().toString(36)
  const visitorName = `E2E Посетитель ${suffix}`
  const visitorEmail = `e2e-${suffix}@example.com`
  const visitorComment = `E2E комментарий ${suffix}`
  const firstTypeName = `E2E Консультация ${suffix}`
  const secondTypeName = `E2E Разбор ${suffix}`

  const firstTypeResponse = await request.post(`${BACKEND_URL}/api/types`, {
    data: {
      name: firstTypeName,
      description: 'Основной сценарий',
      durationMinutes: 30,
    },
  })
  expect(firstTypeResponse.status()).toBe(201)
  const firstType = await firstTypeResponse.json()

  const secondTypeResponse = await request.post(`${BACKEND_URL}/api/types`, {
    data: {
      name: secondTypeName,
      description: 'Другой тип для проверки конфликтов',
      durationMinutes: 60,
    },
  })
  expect(secondTypeResponse.status()).toBe(201)
  const secondType = await secondTypeResponse.json()

  const scheduleResponse = await request.put(`${BACKEND_URL}/api/schedule`, {
    data: scheduleFor(today),
  })
  expect(scheduleResponse.status()).toBe(200)

  const occupiedStart = `${today}T10:00:00`
  const occupiedEnd = `${today}T10:30:00`
  const raceStart = `${today}T10:30:00`
  const otherTypeStart = `${today}T11:00:00`

  await page.goto('/booking')
  await expect(
    page.getByRole('heading', { name: 'Запись на звонок' }),
  ).toBeVisible()

  const typeButton = page.getByTestId(`booking-type-${firstType.id}`)
  await expect(typeButton).toBeVisible()
  await typeButton.click()

  await expect(page.getByTestId('booking-dates')).toBeVisible()
  await page.getByTestId(`booking-date-${today}`).click()

  const occupiedSlot = page.locator(`[data-testid="${slotTestId(occupiedStart)}"]`)
  await expect(occupiedSlot).toBeVisible()
  await occupiedSlot.click()

  await expect(page.getByTestId('booking-name-input')).toBeVisible()
  await page.getByTestId('booking-name-input').fill(visitorName)
  await page.getByTestId('booking-email-input').fill(visitorEmail)
  await page.getByTestId('booking-comment-input').fill(visitorComment)
  await page.getByRole('button', { name: 'Записаться' }).click()

  await expect(page.getByTestId('booking-confirmation')).toBeVisible()
  await expect(page.getByTestId('booking-confirmation-type')).toContainText(
    firstTypeName,
  )
  await expect(page.getByTestId('booking-confirmation-datetime')).toContainText(
    `${formatDateLong(today)}, ${timeOf(occupiedStart)} – ${timeOf(occupiedEnd)}`,
  )
  await expect(page.getByTestId('booking-confirmation-status')).toHaveText(
    'Статус: Подтверждено',
  )

  const sameTimeConflict = await request.post(`${BACKEND_URL}/api/bookings`, {
    data: {
      typeId: firstType.id,
      start: occupiedStart,
      name: 'Повторная запись',
      email: 'same-time@example.com',
    },
  })
  expect(sameTimeConflict.status()).toBe(409)
  expect((await sameTimeConflict.json()).message).toMatch(/занято/)

  const otherTypeConflict = await request.post(`${BACKEND_URL}/api/bookings`, {
    data: {
      typeId: secondType.id,
      start: occupiedStart,
      name: 'Другой тип',
      email: 'other-type@example.com',
    },
  })
  expect(otherTypeConflict.status()).toBe(409)
  expect((await otherTypeConflict.json()).message).toMatch(/занято/)

  const otherTypeBooking = await request.post(`${BACKEND_URL}/api/bookings`, {
    data: {
      typeId: secondType.id,
      start: otherTypeStart,
      name: 'Дмитрий',
      email: 'other-booking@example.com',
      comment: 'Встреча другого типа',
    },
  })
  expect(otherTypeBooking.status()).toBe(201)

  await page.getByRole('button', { name: 'Записаться ещё' }).click()
  await expect(typeButton).toBeVisible()
  await typeButton.click()
  await expect(page.getByTestId('booking-dates')).toBeVisible()
  await page.getByTestId(`booking-date-${today}`).click()

  await expect(
    page.locator(`[data-testid="${slotTestId(occupiedStart)}"]`),
  ).toHaveCount(0)
  const raceSlot = page.locator(`[data-testid="${slotTestId(raceStart)}"]`)
  await expect(raceSlot).toBeVisible()
  await raceSlot.click()

  await page.getByTestId('booking-name-input').fill('Случайный соперник')
  await page.getByTestId('booking-email-input').fill('race@example.com')
  await page.getByTestId('booking-comment-input').fill('Проверка гонки')

  const raceBooking = await request.post(`${BACKEND_URL}/api/bookings`, {
    data: {
      typeId: firstType.id,
      start: raceStart,
      name: 'Соперник',
      email: 'race-created@example.com',
    },
  })
  expect(raceBooking.status()).toBe(201)

  await page.getByRole('button', { name: 'Записаться' }).click()
  await expect(page.getByTestId('booking-conflict')).toBeVisible()
  await expect(
    page.getByText(/Это время уже занято другой записью/),
  ).toBeVisible()
  await expect(
    page.locator(`[data-testid="${slotTestId(raceStart)}"]`),
  ).toHaveCount(0)
  const bookingsAfterConflict = await request.get(
    `${BACKEND_URL}/api/bookings?scope=future`,
  )
  expect(bookingsAfterConflict.status()).toBe(200)
  const bookings = (await bookingsAfterConflict.json()).items
  expect(bookings.filter((booking) => booking.start === raceStart)).toHaveLength(1)

  await page.goto('/owner/bookings')
  await expect(page.getByTestId('owner-bookings-future')).toBeVisible()

  const visitorRow = page
    .locator('[data-testid^="booking-row-"]')
    .filter({ hasText: visitorName })
  await expect(visitorRow).toBeVisible()
  await expect(visitorRow).toContainText(firstTypeName)
  await expect(visitorRow).toContainText('10:00 – 10:30')
  await expect(
    visitorRow.locator('[data-testid^="booking-status-"]'),
  ).toHaveText('Активен')

  await visitorRow.locator('[data-testid^="booking-expand-"]').click()
  await expect(
    visitorRow.locator('[data-testid^="booking-details-"]'),
  ).toContainText(visitorEmail)
  await expect(
    visitorRow.locator('[data-testid^="booking-details-"]'),
  ).toContainText(visitorComment)

  const otherTypeRow = page
    .locator('[data-testid^="booking-row-"]')
    .filter({ hasText: 'Дмитрий' })
  await expect(otherTypeRow).toContainText(secondTypeName)
  await expect(otherTypeRow).toContainText('11:00 – 12:00')

  const cancel = visitorRow.locator('[data-testid^="booking-cancel-"]')
  const bookingId = (await cancel.getAttribute('data-testid')).replace(
    'booking-cancel-',
    '',
  )

  await page.goto('/owner/schedule')
  await expect(page.getByTestId('calendar-week-grid')).toBeVisible()
  await expect(page.getByText('Открыто и свободно')).toBeVisible()
  await expect(page.getByText('Открыто и занято')).toBeVisible()
  await expect(page.getByText('Закрыто')).toBeVisible()
  await expect(page.locator('[data-state="open"]')).not.toHaveCount(0)
  await expect(page.locator('[data-state="occupied"]')).not.toHaveCount(0)
  await expect(page.locator('[data-state="closed"]')).not.toHaveCount(0)
  await expect(
    page.locator('[data-testid^="calendar-visitor-"]').filter({
      hasText: visitorName,
    }),
  ).toHaveCount(2)
  await expect(
    page.locator('[data-testid^="calendar-type-"]').filter({
      hasText: firstTypeName,
    }),
  ).toHaveCount(4)
  await expect(
    page.locator('[data-testid^="calendar-visitor-"]').filter({
      hasText: 'Дмитрий',
    }),
  ).toHaveCount(4)
  await expect(
    page.locator('[data-testid^="calendar-type-"]').filter({
      hasText: secondTypeName,
    }),
  ).toHaveCount(4)

  await page.goto('/owner/bookings')
  await expect(visitorRow).toBeVisible()
  await cancel.click()
  await expect(
    visitorRow.locator('[data-testid^="booking-status-"]'),
  ).toHaveText('Отменён')
  await expect(
    visitorRow.locator('[data-testid^="booking-cancel-"]'),
  ).toHaveCount(0)
  await expect(
    page.getByTestId(`booking-row-${bookingId}`),
  ).toBeVisible()

  await page.goto('/booking')
  await expect(typeButton).toBeVisible()
  await typeButton.click()
  await expect(page.getByTestId('booking-dates')).toBeVisible()
  await page.getByTestId(`booking-date-${today}`).click()
  await expect(
    page.locator(`[data-testid="${slotTestId(occupiedStart)}"]`),
  ).toBeVisible()
})
