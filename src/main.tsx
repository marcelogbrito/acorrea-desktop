import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Registra o Service Worker (o "motor" do PWA)
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

// --- POLYFILL PARA VERSÃO WEB (HÍBRIDA) ---
// Se o aplicativo estiver rodando no navegador web (Vercel), a API do Electron não existe.
// Criamos uma versão "falsa" para evitar que o React quebre e para avisar o usuário amigavelmente.
if (!(window as any).acorreaAPI) {
  const avisoWeb = () => {
    alert("⚠️ Funcionalidade Exclusiva do Desktop!\n\nA geração de arquivos Word, automações do Ginfes e arquivos locais funcionam apenas no aplicativo instalado no computador.");
  };
  
  // Para listeners do Inbox e WhatsApp não darem erro no useEffect
  const listenerVazio = () => () => {};

  (window as any).acorreaAPI = {
    executarPyCad: async () => avisoWeb(),
    abrirGinfes: async () => avisoWeb(),
    encryptPassword: async () => { throw new Error("Criptografia local indisponível na Web"); },
    selecionarArquivo: async () => { avisoWeb(); return null; },
    abrirArquivoLocal: async () => avisoWeb(),
    gerarRelatorioVistoriaPrevia: async () => avisoWeb(),
    gerarPropostaAssessoriaLaudos: async () => avisoWeb(),
    gerarLaudosLote: async () => avisoWeb(),
    sincronizarEmails: async () => avisoWeb(),
    onWhatsAppQR: listenerVazio,
    onInboxProgresso: listenerVazio,
    onInboxLog: listenerVazio,
    onRefreshInbox: listenerVazio
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


