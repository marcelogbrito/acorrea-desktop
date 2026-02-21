// preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acorreaAPI', {
    executarPyCad: (payload: any) => ipcRenderer.invoke('executar-pycad', payload),
    abrirGinfes: (credentials: any) => ipcRenderer.invoke('executar-robo-ginfes', credentials),
    encryptPassword: (password: string) => ipcRenderer.invoke('encrypt-password', password),
    selecionarArquivo: (options: any) => ipcRenderer.invoke('selecionar-arquivo', options),
    abrirArquivoLocal: (caminho: string) => ipcRenderer.invoke('abrir-arquivo-local', caminho),
    gerarRelatorioVistoriaPrevia: (dados: any) => ipcRenderer.invoke('gerar-relatorio-vistoria-previa', dados),
    gerarPropostaAssessoriaLaudos: (dados: any) => ipcRenderer.invoke('gerar-proposta-assessoria-laudos', dados),

    // Gatilho para o botão manual
  sincronizarEmails: () => ipcRenderer.invoke('forcar-sincronizacao'),
  onWhatsAppQR: (callback: (qr: string) => void) => {
  const listener = (_event: any, qr: string) => callback(qr);
  ipcRenderer.on('whatsapp-qr', listener);
  return () => ipcRenderer.removeListener('whatsapp-qr', listener);
},
  
  onInboxProgresso: (callback: any) => {
    const listener = (_event: any, value: any) => callback(value);
    ipcRenderer.on('inbox-progresso', listener);
    return () => ipcRenderer.removeListener('inbox-progresso', listener);
  },
  
  // Novo: Ouvinte para mensagens de log (ERRO ou SUCESSO)
  onInboxLog: (callback: any) => {
    const listener = (_event: any, msg: string) => callback(msg);
    ipcRenderer.on('inbox-log', listener);
    return () => ipcRenderer.removeListener('inbox-log', listener);
  },
  onRefreshInbox: (callback: () => void) => {
  const listener = () => callback();
  ipcRenderer.on('refresh-inbox', listener);
  return () => ipcRenderer.removeListener('refresh-inbox', listener);
},
});