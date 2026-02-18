import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Definição da interface para o progresso
interface ProgressoInbox {
  atual: number;
  total: number;
}

contextBridge.exposeInMainWorld('acorreaAPI', {
  // Adicionamos a tipagem explícita aqui
  executarPyCad: (payload: any) => ipcRenderer.invoke('executar-pycad', payload),
  abrirGinfes: (credentials: any) => ipcRenderer.invoke('executar-robo-ginfes', credentials),
  encryptPassword: (password: string) => ipcRenderer.invoke('encrypt-password', password),
  selecionarArquivo: (options: any) => ipcRenderer.invoke('selecionar-arquivo', options),
  abrirArquivoLocal: (caminho: string) => ipcRenderer.invoke('abrir-arquivo-local', caminho),
  // NOVO: Escutador de eventos para o Progresso do Inbox
  // Escutador de progresso que o React vai usar
  onInboxProgresso: (callback: (dados: ProgressoInbox) => void) => {
    const subscription = (_event: IpcRendererEvent, value: ProgressoInbox) => callback(value);
    
    ipcRenderer.on('inbox-progresso', subscription);

    // Retorna uma função para remover o listener (cleanup)
    return () => ipcRenderer.removeListener('inbox-progresso', subscription);
  },
  
  // Função para forçar uma atualização manual se quiser
  sincronizarAgora: () => ipcRenderer.invoke('forcar-sincronizacao-inbox'),
    
  // Limpador de eventos (boa prática para evitar lentidão)
  removeInboxListener: () => ipcRenderer.removeAllListeners('inbox-progresso')
})