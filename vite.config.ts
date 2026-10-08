import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const storyProxy = {
  '/remote/childrenstory': {
    target: 'https://childrenstory.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/remote\/childrenstory/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: storyProxy },
  preview: { proxy: storyProxy },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
