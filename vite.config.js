import { defineConfig } from 'vite'
import pugPlugin from 'vite-plugin-pug'
import { resolve } from 'node:path'

const locals = { siteName: 'EduPlatform', year: new Date().getFullYear() }
const pages = ['index', 'courses', 'login', 'cabinet', 'test', 'calc', 'curriculum', 'teacher', 'admin']

export default defineConfig({
  plugins: [pugPlugin({}, locals)],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
})
