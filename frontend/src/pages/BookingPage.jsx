import { Button, Container, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

function BookingPage() {
  return (
    <Container py="xl">
      <Title order={1}>Запись на звонок</Title>

      <Text mt="sm">Здесь появится запись на звонок</Text>

      <Button component={Link} to="/" mt="md" variant="default">
        Назад на главную
      </Button>
    </Container>
  )
}

export default BookingPage