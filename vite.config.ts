import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiPlugin } from './localApi'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [
      react(),
      apiPlugin({
        jamendoClientId: env.VITE_JAMENDO_CLIENT_ID ?? '',
        pollinationsApiKey: env.POLLINATIONS_API_KEY ?? '',
        pollinationsImageModel: env.POLLINATIONS_IMAGE_MODEL ?? '',
        cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID ?? '',
        cloudflareApiToken: env.CLOUDFLARE_API_TOKEN ?? '',
        cloudflareImageModel: env.CLOUDFLARE_IMAGE_MODEL ?? '',
      }),
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: 'http://127.0.0.1:5173/',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')

            if (normalizedId.includes('/node_modules/')) {
              return 'vendor'
            }

            if (
              normalizedId.includes('/src/screens/PuzzleScreen.tsx') ||
              normalizedId.includes('/src/screens/puzzle/') ||
              normalizedId.includes('/src/services/Puzzle') ||
              normalizedId.includes('/src/services/ExactPuzzle')
            ) {
              return 'puzzle'
            }

            if (
              normalizedId.includes('/src/screens/UploadScreen.tsx') ||
              normalizedId.includes('/src/screens/upload/')
            ) {
              return 'upload'
            }

            if (
              normalizedId.includes('/src/screens/CropScreen.tsx') ||
              normalizedId.includes('/src/services/CropService.ts')
            ) {
              return 'crop'
            }

            return undefined
          },
        },
      },
    },
  }
})
