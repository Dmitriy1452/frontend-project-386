import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

const PAST_PAGE_LIMIT = 5

const STATUS_LABELS = {
  active: 'Активен',
  cancelled: 'Отменён',
}

function dateOf(dateTime) {
  return dateTime.slice(0, 10)
}

function timeOf(dateTime) {
  return dateTime.slice(11, 16)
}

function formatDateLong(date) {
  const [year, month, day] = date.split('-')
  return `${day}.${month}.${year}`
}

function formatInterval(booking) {
  return `${timeOf(booking.start)} – ${timeOf(booking.end)}`
}

function groupByDate(bookings) {
  const groups = {}
  for (const booking of bookings) {
    const date = dateOf(booking.start)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(booking)
  }
  return groups
}

function BookingRow({
  booking,
  expanded,
  onToggleExpand,
  onCancel,
  cancellingId,
}) {
  const isExpanded = Boolean(expanded[booking.id])
  return (
    <div data-testid={`booking-row-${booking.id}`}>
      <Group justify="space-between" align="center" py="xs" wrap="nowrap">
        <Stack gap={2}>
          <Text fw={600}>{booking.type.name}</Text>
          <Text size="sm" c="dimmed">
            {booking.name} · {formatInterval(booking)}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Badge
            color={booking.status === 'active' ? 'green' : 'gray'}
            data-testid={`booking-status-${booking.id}`}
          >
            {STATUS_LABELS[booking.status] ?? booking.status}
          </Badge>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => onToggleExpand(booking.id)}
            data-testid={`booking-expand-${booking.id}`}
          >
            {isExpanded ? 'Скрыть' : 'Детали'}
          </Button>
          {booking.status === 'active' && (
            <Button
              size="xs"
              color="red"
              variant="default"
              onClick={() => onCancel(booking)}
              loading={cancellingId === booking.id}
              data-testid={`booking-cancel-${booking.id}`}
            >
              Отменить
            </Button>
          )}
        </Group>
      </Group>
      {isExpanded && (
        <Stack
          gap={2}
          pl="md"
          pb="xs"
          data-testid={`booking-details-${booking.id}`}
        >
          <Text size="sm" c="dimmed">
            Email: {booking.email}
          </Text>
          <Text size="sm" c="dimmed">
            Комментарий:{' '}
            {booking.comment === undefined || booking.comment === ''
              ? 'нет'
              : booking.comment}
          </Text>
        </Stack>
      )}
    </div>
  )
}

function BookingSection({
  title,
  groups,
  descending,
  sectionTestId,
  emptyTestId,
  emptyText,
  rowProps,
}) {
  if (groups === null) {
    return null
  }
  const dates = Object.keys(groups).sort((a, b) =>
    descending ? b.localeCompare(a) : a.localeCompare(b),
  )
  return (
    <div data-testid={sectionTestId}>
      <Title order={2} mt="xl">
        {title}
      </Title>
      {dates.length === 0 ? (
        <Text c="dimmed" mt="md" data-testid={emptyTestId}>
          {emptyText}
        </Text>
      ) : (
        dates.map((date) => (
          <div key={date} data-testid={`owner-bookings-group-${date}`}>
            <Text fw={600} mt="md">
              {formatDateLong(date)}
            </Text>
            <Divider my="xs" />
            {groups[date].map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                {...rowProps}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function OwnerBookingsPage() {
  const [future, setFuture] = useState(null)
  const [past, setPast] = useState(null)
  const [pastCursor, setPastCursor] = useState(null)
  const [pastLoading, setPastLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [cancelError, setCancelError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    let cancelled = false

    const fetchAll = async (scope) => {
      const fetched = []
      let cursor
      do {
        const page = await api.listBookings(scope, cursor)
        fetched.push(...page.items)
        cursor = page.nextCursor ?? null
      } while (cursor)
      return fetched
    }

    const load = async () => {
      try {
        const [futureItems, pastPage] = await Promise.all([
          fetchAll('future'),
          api.listBookings('past', undefined, PAST_PAGE_LIMIT),
        ])
        if (!cancelled) {
          setFuture(futureItems)
          setPast(pastPage.items)
          setPastCursor(pastPage.nextCursor ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить записи',
          )
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const futureGroups = useMemo(
    () => (future === null ? null : groupByDate(future)),
    [future],
  )
  const pastGroups = useMemo(
    () => (past === null ? null : groupByDate(past)),
    [past],
  )

  const toggleExpand = (id) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }))
  }

  const handleShowMore = async () => {
    if (pastCursor === null || pastLoading) {
      return
    }
    setPastLoading(true)
    setLoadError(null)
    try {
      const page = await api.listBookings('past', pastCursor, PAST_PAGE_LIMIT)
      setPast((current) => [...current, ...page.items])
      setPastCursor(page.nextCursor ?? null)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Не удалось загрузить записи',
      )
    } finally {
      setPastLoading(false)
    }
  }

  const updateInLists = (updated) => {
    setFuture((current) =>
      current === null
        ? current
        : current.map((item) => (item.id === updated.id ? updated : item)),
    )
    setPast((current) =>
      current === null
        ? current
        : current.map((item) => (item.id === updated.id ? updated : item)),
    )
  }

  const handleCancel = async (booking) => {
    setCancellingId(booking.id)
    setCancelError(null)
    try {
      const updated = await api.cancelBooking(booking.id)
      updateInLists(updated)
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : 'Не удалось отменить запись',
      )
    } finally {
      setCancellingId(null)
    }
  }

  const rowProps = {
    expanded,
    cancellingId,
    onToggleExpand: toggleExpand,
    onCancel: handleCancel,
  }

  return (
    <Container py="xl" size="md">
      <Title order={1}>Звонки</Title>

      <Text c="dimmed" mt="sm">
        <Link to="/">Назад на главную</Link>
      </Text>

      {loadError && (
        <Alert color="red" mt="md" data-testid="owner-bookings-load-error">
          {loadError}
        </Alert>
      )}
      {cancelError && (
        <Alert color="red" mt="md" data-testid="owner-bookings-cancel-error">
          {cancelError}
        </Alert>
      )}

      {future === null && past === null ? (
        !loadError && <Loader mt="lg" data-testid="owner-bookings-loading" />
      ) : (
        <>
          <BookingSection
            title="Будущие звонки"
            groups={futureGroups}
            descending={false}
            sectionTestId="owner-bookings-future"
            emptyTestId="owner-bookings-future-empty"
            emptyText="Будущих звонков нет"
            rowProps={rowProps}
          />
          <BookingSection
            title="Прошедшие звонки"
            groups={pastGroups}
            descending
            sectionTestId="owner-bookings-past"
            emptyTestId="owner-bookings-past-empty"
            emptyText="Прошедших звонков нет"
            rowProps={rowProps}
          />
          {past !== null && pastCursor !== null && (
            <Button
              mt="lg"
              variant="default"
              onClick={handleShowMore}
              loading={pastLoading}
              data-testid="owner-bookings-show-more"
            >
              Показать ещё
            </Button>
          )}
        </>
      )}
    </Container>
  )
}

export default OwnerBookingsPage