import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { VitePWA } from 'vite-plugin-pwa' // <-- IMPORTAÇÃO DO PWA

const isWeb = process.env.VERCEL === '1' || process.env.BUILD_TARGET === 'web';

export default defineConfig({
  base: isWeb ? '/' : './', 
  
  // 👇 ADICIONE ESTE BLOCO AQUI PARA IGNORAR AS PASTAS DO WHATSAPP 👇
  server: {
    watch: {
      ignored: ['**/.wwebjs_auth/**', '**/.wwebjs_cache/**']
    }
  },
  
  plugins: [
    react(),
    
    // CONFIGURAÇÃO DO PWA (Executa tanto na web quanto localmente para testes)
    VitePWA({
      registerType: 'autoUpdate', // Atualiza o app automaticamente quando você subir nova versão
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Acorrea Gestão',
        short_name: 'Acorrea',
        description: 'Sistema de Gestão e Emissão de Laudos AVCB',
        theme_color: '#1a3353', // Cor da barra de status no telemóvel (combina com o seu header)
        background_color: '#f4f7f6',
        display: 'standalone', // Faz abrir em tela cheia parecendo app nativo
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    
    ...(isWeb ? [] : [
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: ['whatsapp-web.js', 'bufferutil', 'utf-8-validate','playwright', 'playwright-core'],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
        },
        renderer: process.env.NODE_ENV === 'test' ? undefined : {},
      }),
      
      viteStaticCopy({
        targets: [
          { src: 'automation/*', dest: 'automation' }
        ]
      })
    ])
  ],
})