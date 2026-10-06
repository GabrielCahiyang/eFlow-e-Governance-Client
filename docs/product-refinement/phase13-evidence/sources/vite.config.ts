import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(configDir, 'src/assets', filename)
      }
    },
  }
}


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, configDir, '')
  Object.assign(process.env, env)

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them.
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(configDir, './src'),
      },
    },
    server: {
      proxy: {
        // Every local backend call now enters through the JWT-protected eFlow
        // gateway. Port 8321 is deliberately never a Vite proxy target.
        '/controlpanelEflow': {
          target: 'http://127.0.0.1:8322',
          changeOrigin: true,
        },
        // Temporary compatibility route for callers still using /api/*.
        '/api': {
          target: 'http://127.0.0.1:8322',
          changeOrigin: true,
          rewrite: (requestPath: string) => `/controlpanelEflow${requestPath}`,
        },
      },
    },
  }
})
