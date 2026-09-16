import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

const DAY_NAMES = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const DEFAULT_INTERVAL = { start: '09:00', end: '10:00' }

function validateSchedule(schedule) {
  for (const day of schedule.days) {
    for (const interval of day.intervals) {
      if (
        !TIME_PATTERN.test(interval.start) ||
        !TIME_PATTERN.test(interval.end)
      ) {
        return 'Время интервала должно быть в формате HH:MM'
      }
      if (interval.start >= interval.end) {
        return (
          `${DAY_NAMES[day.dayOfWeek]}: интервал ` +
          `${interval.start}–${interval.end} должен начинаться раньше конца`
        )
      }
    }
  }
  return null
}

function OwnerSchedulePage() {
  const [schedule, setSchedule] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api
      .getSchedule()
      .then(setSchedule)
      .catch((error) => setLoadError(error.message))
  }, [])

  function updateDay(dayOfWeek, updater) {
    setSchedule((current) => ({
      days: current.days.map((day) =>
        day.dayOfWeek === dayOfWeek ? updater(day) : day,
      ),
    }))
    setSaved(false)
    setSaveError(null)
  }

  const toggleDay = (dayOfWeek) => {
    updateDay(dayOfWeek, (day) =>
      day.intervals.length > 0
        ? { ...day, intervals: [] }
        : { ...day, intervals: [{ ...DEFAULT_INTERVAL }] },
    )
  }

  const addInterval = (dayOfWeek) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      intervals: [...day.intervals, { ...DEFAULT_INTERVAL }],
    }))
  }

  const changeInterval = (dayOfWeek, index, patch) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      intervals: day.intervals.map((interval, intervalIndex) =>
        intervalIndex === index ? { ...interval, ...patch } : interval,
      ),
    }))
  }

  const removeInterval = (dayOfWeek, index) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      intervals: day.intervals.filter((_, intervalIndex) => intervalIndex !== index),
    }))
  }

  const handleSave = async () => {
    const validation = validateSchedule(schedule)
    if (validation) {
      setSaveError(validation)
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const result = await api.putSchedule(schedule)
      setSchedule(result)
      setSaved(true)
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить расписание',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container py="xl" size="md">
      <Title order={1}>Календарь</Title>

      <Text c="dimmed">
        Настройте недельное расписание. День без интервалов считается закрытым.
      </Text>

      <Text c="dimmed" mt="xs">
        <Link to="/">Назад на главную</Link>
      </Text>

      {loadError && (
        <Alert color="red" mt="md" data-testid="schedule-load-error">
          {loadError}
        </Alert>
      )}

      {schedule === null ? (
        !loadError && <Loader mt="lg" data-testid="schedule-loading" />
      ) : (
        <>
          <Stack mt="lg" gap="lg">
            {schedule.days.map((day) => {
              const isOpen = day.intervals.length > 0
              return (
                <Stack key={day.dayOfWeek} gap="xs">
                  <Group justify="space-between">
                    <Switch
                      label={DAY_NAMES[day.dayOfWeek]}
                      checked={isOpen}
                      onChange={() => toggleDay(day.dayOfWeek)}
                      data-testid={`day-toggle-${day.dayOfWeek}`}
                    />
                    <Text c="dimmed" size="sm" data-testid={`day-status-${day.dayOfWeek}`}>
                      {isOpen ? 'Открыт' : 'Закрыт'}
                    </Text>
                  </Group>

                  {isOpen && (
                    <>
                      {day.intervals.map((interval, index) => (
                        <Group key={index} gap="sm">
                          <TextInput
                            label="Начало"
                            type="time"
                            data-testid={`interval-start-${day.dayOfWeek}-${index}`}
                            value={interval.start}
                            onChange={(event) =>
                              changeInterval(day.dayOfWeek, index, {
                                start: event.currentTarget.value,
                              })
                            }
                          />
                          <TextInput
                            label="Конец"
                            type="time"
                            data-testid={`interval-end-${day.dayOfWeek}-${index}`}
                            value={interval.end}
                            onChange={(event) =>
                              changeInterval(day.dayOfWeek, index, {
                                end: event.currentTarget.value,
                              })
                            }
                          />
                          <Button
                            variant="subtle"
                            color="red"
                            mt="lg"
                            onClick={() =>
                              removeInterval(day.dayOfWeek, index)
                            }
                            data-testid={`interval-remove-${day.dayOfWeek}-${index}`}
                          >
                            Удалить
                          </Button>
                        </Group>
                      ))}
                      <div>
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => addInterval(day.dayOfWeek)}
                          data-testid={`interval-add-${day.dayOfWeek}`}
                        >
                          Добавить интервал
                        </Button>
                      </div>
                    </>
                  )}
                </Stack>
              )
            })}
          </Stack>

          {saveError && (
            <Alert color="red" mt="lg" data-testid="schedule-save-error">
              {saveError}
            </Alert>
          )}
          {saved && (
            <Text c="green" mt="md" data-testid="schedule-saved">
              Расписание сохранено
            </Text>
          )}

          <Button mt="lg" size="md" onClick={handleSave} loading={saving}>
            Сохранить расписание
          </Button>
        </>
      )}
    </Container>
  )
}

export default OwnerSchedulePage