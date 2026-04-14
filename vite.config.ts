import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Identifica automaticamente se a compilação está a ocorrer na Vercel (Web)
const isWeb = process.env.VERCEL === '1' || process.env.BUILD_TARGET === 'web';

// https://vitejs.dev/config/
export default defineConfig({
  // MUITO IMPORTANTE: O Electron precisa de './' para encontrar os arquivos localmente.
  // Já a Vercel (Web) prefere o padrão '/' para resolver os caminhos na nuvem.
  base: isWeb ? '/' : './', 
  
  plugins: [
    react(),
    
    // O operador spread (...) injeta estes plugins APENAS se NÃO for Web
    ...(isWeb ? [] : [
      electron({
        main: {
          // Shortcut of `build.lib.entry`.
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                // Isso diz ao Vite: "Não tente empacotar o playwright, 
                // deixe que o Node o carregue direto da node_modules"
                external: ['whatsapp-web.js', 'bufferutil', 'utf-8-validate','playwright', 'playwright-core'],
              },
            },
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload.ts',
        },
        // Ployfill the Electron and Node.js API for Renderer process.
        renderer: process.env.NODE_ENV === 'test'
          ? undefined
          : {},
      }),
      
      // O StaticCopy também fica restrito ao Desktop, pois a Vercel não executa estes workers
      viteStaticCopy({
        targets: [
          {
            src: 'automation/*', // Origem: pasta na raiz
            dest: 'automation'   // Destino: dentro de dist-electron
          }
        ]
      })
    ])
  ],
})