import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../api/client.js'

const EMPTY_FORM = { name: '', description: '', durationMinutes: '' }

function normalizeDuration(value) {
  return Number(value)
}

function validateForm({ name, durationMinutes }) {
  const errors = {}
  if (name.trim() === '') {
    errors.name = 'Название не может быть пустым'
  }
  if (
    !Number.isInteger(normalizeDuration(durationMinutes)) ||
    normalizeDuration(durationMinutes) < 1
  ) {
    errors.durationMinutes =
      'Длительность должна быть положительным целым числом'
  }
  return errors
}

function OwnerTypesPage() {
  const [types, setTypes] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [confirmingId, setConfirmingId] = useState(null)

  useEffect(() => {
    api
      .listBookingTypes()
      .then(setTypes)
      .catch((error) => setLoadError(error.message))
  }, [])

  const reload = async () => {
    try {
      setTypes(await api.listBookingTypes())
    } catch (error) {
      setLoadError(error.message)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (type) => {
    setEditingId(type.id)
    setForm({
      name: type.name,
      description: type.description ?? '',
      durationMinutes: type.durationMinutes.toFixed(0),
    })
    setFieldErrors({})
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (submitting) {
      return
    }
    setFormOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        durationMinutes: normalizeDuration(form.durationMinutes),
      }
      if (editingId === null) {
        await api.createBookingType(payload)
      } else {
        const current = types.find((type) => type.id === editingId)
        const patch = {}
        if (payload.name !== current?.name) {
          patch.name = payload.name
        }
        if (payload.description !== current?.description) {
          patch.description = payload.description
        }
        if (payload.durationMinutes !== current?.durationMinutes) {
          patch.durationMinutes = payload.durationMinutes
        }
        await api.updateBookingType(editingId, patch)
      }
      setFormOpen(false)
      setEditingId(null)
      await reload()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ name: error.message })
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Не удалось выполнить запрос',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (type) => {
    if (confirmingId === type.id) {
      try {
        await api.deleteBookingType(type.id)
        setTypes((current) => current.filter((item) => item.id !== type.id))
      } catch (error) {
        setLoadError(error.message)
      }
      setConfirmingId(null)
    } else {
      setConfirmingId(type.id)
    }
  }

  return (
    <Container py="xl">
      <Group justify="space-between" align="center" mb="md">
        <Title order={1}>Типы звонков</Title>
        <Button onClick={openCreate}>Создать тип</Button>
      </Group>

      <Text c="dimmed" mb="md">
        <Link to="/">Назад на главную</Link>
      </Text>

      {loadError && (
        <Alert color="red" mb="md" data-testid="owner-types-load-error">
          {loadError}
        </Alert>
      )}

      {types === null ? (
        !loadError && <Loader data-testid="owner-types-loading" />
      ) : (
        <>
          {types.length === 0 ? (
            <Text data-testid="owner-types-empty">Типов пока нет</Text>
          ) : (
            <Table data-testid="owner-types-table">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Описание</Table.Th>
                  <Table.Th>Длительность</Table.Th>
                  <Table.Th>Действия</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {types.map((type) => (
                  <Table.Tr key={type.id} data-testid={`type-row-${type.id}`}>
                    <Table.Td>{type.name}</Table.Td>
                    <Table.Td>{type.description || '—'}</Table.Td>
                    <Table.Td>{type.durationMinutes} мин</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => openEdit(type)}
                        >
                          Редактировать
                        </Button>
                        <Button
                          size="xs"
                          color={confirmingId === type.id ? 'red' : 'gray'}
                          variant={confirmingId === type.id ? 'filled' : 'default'}
                          onClick={() => handleDelete(type)}
                        >
                          {confirmingId === type.id
                            ? 'Подтвердить удаление'
                            : 'Удалить'}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </>
      )}

      <Modal
        opened={formOpen}
        onClose={closeForm}
        title={editingId === null ? 'Новый тип звонка' : 'Правка типа звонка'}
        data-testid="owner-types-form-modal"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <Stack>
            {formError && (
              <Alert color="red" data-testid="owner-types-form-error">
                {formError}
              </Alert>
            )}
            <TextInput
              label="Название"
              maxLength={120}
              data-testid="type-name-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              error={fieldErrors.name}
            />
            <TextInput
              label="Описание"
              data-testid="type-description-input"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.currentTarget.value })
              }
            />
            <TextInput
              label="Длительность, минут"
              inputMode="numeric"
              data-testid="type-duration-input"
              value={form.durationMinutes}
              onChange={(event) =>
                setForm({ ...form, durationMinutes: event.currentTarget.value })
              }
              error={fieldErrors.durationMinutes}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={submitting}>
                {editingId === null ? 'Создать' : 'Сохранить'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  )
}

export default OwnerTypesPage
