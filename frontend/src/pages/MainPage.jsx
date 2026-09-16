import { Box, Button, Container, SimpleGrid, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

const steps = [
  {
    title: 'Выберите удобный слот',
    description: 'Откройте свободные слоты и выберите подходящее время.',
  },
  {
    title: 'Запишитесь на звонок',
    description: 'Зафиксируйте выбранный слот за собой в пару кликов.',
  },
  {
    title: 'Подключайтесь в назначенное время',
    description: 'Получите напоминание и подключайтесь к звонку.',
  },
]

function MainPage() {
  return (
    <Container py="xl">
      <Title order={1}>Календарь звонков</Title>

      <Text mt="sm">Запишитесь на звонок в пару кликов</Text>

      <Button component={Link} to="/booking" mt="md">
        Записаться
      </Button>

      <Title order={2} mt="xl">
        Как это работает
      </Title>

      <SimpleGrid cols={3} mt="md">
        {steps.map((step) => (
          <div key={step.title}>
            <Title order={3}>{step.title}</Title>
            <Text mt="xs">{step.description}</Text>
          </div>
        ))}
      </SimpleGrid>

      <Text fw={600} mt="xl">
        Готовы записаться? Выберите удобный слот.
      </Text>

      <Button component={Link} to="/booking" mt="md">
        Записаться
      </Button>

      <Box component="footer" mt="xl" ta="center">
        <Text size="sm" c="dimmed">
          <Link to="/owner/types">Управление владельца: типы звонков</Link>
        </Text>
        <Text size="sm" c="dimmed" mt="xs">
          <Link to="/owner/schedule">Управление владельца: календарь</Link>
        </Text>
        <Text size="sm" c="dimmed" mt="xs">
          © Календарь звонков
        </Text>
      </Box>
    </Container>
  )
}

export default MainPage