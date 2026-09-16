import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/client.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

const DAY_NAMES = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function todayLocalDate() {
  const now = new Date()
  return [
    String(now.getFullYear()).padStart(4, '0'),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
  ].join('-')
}

function addDays(date, count) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + count))
  return [
    String(result.getUTCFullYear()).padStart(4, '0'),
    pad2(result.getUTCMonth() + 1),
    pad2(result.getUTCDate()),
  ].join('-')
}

function dateOf(slotStart) {
  return slotStart.slice(0, 10)
}

function timeOf(dateTime) {
  return dateTime.slice(11, 16)
}

function formatDateLong(date) {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function formatSlotLabel(slot) {
  return `${timeOf(slot.start)} – ${timeOf(slot.end)}`
}

function BookingPage() {
  const [types, setTypes] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [selectedTypeId, setSelectedTypeId] = useState(null)
  const [slots, setSlots] = useState(null)
  const [slotsError, setSlotsError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlotStart, setSelectedSlotStart] = useState(null)

  const [form, setForm] = useState({ name: '', email: '', comment: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [conflictMessage, setConflictMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [booking, setBooking] = useState(null)

  const windowFrom = useMemo(() => todayLocalDate(), [])
  const windowTo = useMemo(() => addDays(windowFrom, 13), [windowFrom])

  useEffect(() => {
    let cancelled = false
    api
      .listBookingTypes()
      .then((data) => {
        if (!cancelled) {
          setTypes(data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadSlots = async (typeId) => {
    setSlots(null)
    setSlotsError(null)
    setSelectedDate(null)
    setSelectedSlotStart(null)
    try {
      const result = await api.listSlots(typeId, windowFrom, windowTo)
      setSlots(result)
    } catch (error) {
      setSlotsError(
        error instanceof Error ? error.message : 'Не удалось загрузить слоты',
      )
    }
  }

  const selectType = (typeId) => {
    if (typeId === selectedTypeId) {
      return
    }
    setSelectedTypeId(typeId)
    setConflictMessage(null)
    loadSlots(typeId)
  }

  const availableDates = useMemo(() => {
    if (slots === null) {
      return []
    }
    const dates = [...new Set(slots.map((slot) => dateOf(slot.start)))]
    return dates.sort()
  }, [slots])

  const effectiveDate =
    selectedDate !== null && availableDates.includes(selectedDate)
      ? selectedDate
      : availableDates[0] ?? null

  const daySlots = useMemo(() => {
    if (slots === null || effectiveDate === null) {
      return []
    }
    return slots.filter((slot) => dateOf(slot.start) === effectiveDate)
  }, [slots, effectiveDate])

  const selectedSlot =
    selectedSlotStart === null
      ? null
      : (slots ?? []).find((slot) => slot.start === selectedSlotStart) ?? null

  const handleSlotSelect = (slot) => {
    setSelectedSlotStart(slot.start)
    setFieldErrors({})
    setFormError(null)
    setConflictMessage(null)
  }

  const validateForm = () => {
    const errors = {}
    if (form.name.trim() === '') {
      errors.name = 'Укажите имя'
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      errors.email = 'Укажите корректный email'
    }
    return errors
  }

  const handleSubmit = async () => {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSubmitting(true)
    setFormError(null)
    setConflictMessage(null)
    try {
      const payload = {
        typeId: selectedTypeId,
        start: selectedSlotStart,
        name: form.name.trim(),
        email: form.email.trim(),
        comment: form.comment.trim() === '' ? undefined : form.comment.trim(),
      }
      const created = await api.createBooking(payload)
      setBooking(created)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflictMessage(error.message)
        await loadSlots(selectedTypeId)
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Не удалось выполнить запись',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setBooking(null)
    setTypes(null)
    setLoadError(null)
    setSelectedTypeId(null)
    setSlots(null)
    setSlotsError(null)
    setSelectedDate(null)
    setSelectedSlotStart(null)
    setForm({ name: '', email: '', comment: '' })
    setFieldErrors({})
    setFormError(null)
    setConflictMessage(null)
    api
      .listBookingTypes()
      .then(setTypes)
      .catch((error) => setLoadError(error.message))
  }

  if (booking !== null) {
    return (
      <Container py="xl" size="sm">
        <Title order={1}>Запись на звонок</Title>
        <Alert
          color="green"
          mt="md"
          title="Вы записаны"
          data-testid="booking-confirmation"
        >
          <Stack gap={4}>
            <Text data-testid="booking-confirmation-type">
              Тип звонка: {booking.type.name}
            </Text>
            <Text data-testid="booking-confirmation-datetime">
              Когда: {formatDateLong(dateOf(booking.start))},{' '}
              {formatSlotLabel(booking)}
            </Text>
            <Text data-testid="booking-confirmation-status">
              Статус: {booking.status === 'active' ? 'Подтверждено' : booking.status}
            </Text>
          </Stack>
        </Alert>
        <Text c="dimmed" mt="md">
          {booking.name}, до звонка останется время подготовиться. Подключение
          не требуется — сервис напомнит о встрече.
        </Text>
        <Group mt="lg">
          <Button variant="default" onClick={resetAll}>
            Записаться ещё
          </Button>
          <Button component={Link} to="/" variant="subtle">
            Назад на главную
          </Button>
        </Group>
      </Container>
    )
  }

  return (
    <Container py="xl" size="md">
      <Title order={1}>Запись на звонок</Title>

      <Text c="dimmed" mt="sm">
        <Link to="/">Назад на главную</Link>
      </Text>

      {loadError && (
        <Alert color="red" mt="md" data-testid="booking-load-error">
          {loadError}
        </Alert>
      )}

      {types === null ? (
        !loadError && <Loader mt="lg" data-testid="booking-types-loading" />
      ) : (
        <Stack mt="lg">
          <Text fw={600}>1. Выберите тип звонка</Text>
          {types.length === 0 ? (
            <Text data-testid="booking-types-empty">
              Сейчас нет доступных типов звонков
            </Text>
          ) : (
            <SimpleGrid cols={2}>
              {types.map((type) => (
                <Button
                  key={type.id}
                  variant={selectedTypeId === type.id ? 'filled' : 'default'}
                  justify="space-between"
                  onClick={() => selectType(type.id)}
                  data-testid={`booking-type-${type.id}`}
                  style={{ height: 'auto', paddingBlock: 12 }}
                >
                  <Stack gap={0} align="stretch">
                    <Text fw={600}>{type.name}</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      {type.description || `${type.durationMinutes} мин`}
                    </Text>
                  </Stack>
                </Button>
              ))}
            </SimpleGrid>
          )}

          {selectedTypeId !== null && (
            <>
              <Text fw={600} mt="md">
                2. Выберите свободный слот
              </Text>

              {slotsError && (
                <Alert color="red" data-testid="booking-slots-error">
                  {slotsError}
                </Alert>
              )}

              {slots === null && !slotsError && (
                <Loader size="sm" data-testid="booking-slots-loading" />
              )}

              {slots !== null && slots.length === 0 && (
                <Text data-testid="booking-slots-empty">
                  На ближайшие 14 дней свободных слотов нет
                </Text>
              )}

              {slots !== null && slots.length > 0 && (
                <Stack gap="md">
                  <Group gap="sm" wrap="wrap" data-testid="booking-dates">
                    {availableDates.map((date) => (
                      <Button
                        key={date}
                        size="xs"
                        variant={effectiveDate === date ? 'filled' : 'default'}
                        onClick={() => setSelectedDate(date)}
                        data-testid={`booking-date-${date}`}
                      >
                        {DAY_NAMES[dateOfDayOfWeek(date)]},{' '}
                        {formatDateLong(date)}
                      </Button>
                    ))}
                  </Group>

                  <Group gap="sm">
                    {daySlots.map((slot) => (
                      <Button
                        key={slot.start}
                        size="xs"
                        variant={
                          selectedSlotStart === slot.start
                            ? 'filled'
                            : 'default'
                        }
                        onClick={() => handleSlotSelect(slot)}
                        data-testid={`booking-slot-${slot.start}`}
                      >
                        {formatSlotLabel(slot)}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              )}

              {conflictMessage && (
                <Alert color="red" mt="md" data-testid="booking-conflict">
                  {conflictMessage} Выберите другое время — доступные слоты уже
                  обновлены.
                </Alert>
              )}

              {selectedSlot !== null && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleSubmit()
                  }}
                  data-testid="booking-form"
                >
                  <Stack mt="lg">
                    <Text fw={600}>
                      3. Ваши данные
                    </Text>
                    <Text c="dimmed" size="sm" data-testid="booking-slot-summary">
                      {selectedTypeName(types, selectedTypeId)} ·{' '}
                      {formatDateLong(effectiveDate)} ·{' '}
                      {formatSlotLabel(selectedSlot)} (время владельца)
                    </Text>

                    {formError && (
                      <Alert color="red" data-testid="booking-form-error">
                        {formError}
                      </Alert>
                    )}

                    <TextInput
                      label="Имя"
                      data-testid="booking-name-input"
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.currentTarget.value })
                      }
                      error={fieldErrors.name}
                    />
                    <TextInput
                      label="Email"
                      data-testid="booking-email-input"
                      inputMode="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm({ ...form, email: event.currentTarget.value })
                      }
                      error={fieldErrors.email}
                    />
                    <Textarea
                      label="Комментарий (необязательно)"
                      data-testid="booking-comment-input"
                      autosize
                      minRows={2}
                      value={form.comment}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          comment: event.currentTarget.value,
                        })
                      }
                    />
                    <Group justify="flex-end">
                      <Button type="submit" loading={submitting}>
                        Записаться
                      </Button>
                    </Group>
                  </Stack>
                </form>
              )}
            </>
          )}
        </Stack>
      )}
    </Container>
  )
}

function selectedTypeName(types, typeId) {
  return types?.find((type) => type.id === typeId)?.name ?? ''
}

function dateOfDayOfWeek(date) {
  const [year, month, day] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return dow === 0 ? 7 : dow
}

export default BookingPage