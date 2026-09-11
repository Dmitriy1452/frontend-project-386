import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const root = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mantine/core': root('./node_modules/@mantine/core'),
      '@mantine/hooks': root('./node_modules/@mantine/hooks'),
      react: root('./node_modules/react'),
      'react-dom': root('./node_modules/react-dom'),
      'react-router-dom': root('./node_modules/react-router-dom'),
    },
  },
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
  },
})