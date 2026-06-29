import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: '',
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        // svgr options
      },
    }),
  ],
  // cubing/search uses web workers that need ES format for production builds.
  // In dev mode (serve), Vite handles workers natively without this setting.
  ...(command === 'build' ? { worker: { format: 'es' as const } } : {}),
}))
