"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("acorreaAPI", {
  // Adicionamos a tipagem explícita aqui
  executarPyCad: (payload) => electron.ipcRenderer.invoke("executar-pycad", payload),
  abrirGinfes: (credentials) => electron.ipcRenderer.invoke("executar-robo-ginfes", credentials),
  encryptPassword: (password) => electron.ipcRenderer.invoke("encrypt-password", password),
  selecionarArquivo: (options) => electron.ipcRenderer.invoke("selecionar-arquivo", options),
  abrirArquivoLocal: (caminho) => electron.ipcRenderer.invoke("abrir-arquivo-local", caminho),
  // NOVO: Escutador de eventos para o Progresso do Inbox
  // Escutador de progresso que o React vai usar
  onInboxProgresso: (callback) => {
    const subscription = (_event, value) => callback(value);
    electron.ipcRenderer.on("inbox-progresso", subscription);
    return () => electron.ipcRenderer.removeListener("inbox-progresso", subscription);
  },
  // Função para forçar uma atualização manual se quiser
  sincronizarAgora: () => electron.ipcRenderer.invoke("forcar-sincronizacao-inbox"),
  // Limpador de eventos (boa prática para evitar lentidão)
  removeInboxListener: () => electron.ipcRenderer.removeAllListeners("inbox-progresso")
});
