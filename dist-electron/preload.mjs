"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("acorreaAPI", {
  executarPyCad: (payload) => ipcRenderer.invoke("executar-pycad", payload),
  abrirGinfes: (credentials) => ipcRenderer.invoke("executar-robo-ginfes", credentials),
  encryptPassword: (password) => ipcRenderer.invoke("encrypt-password", password),
  selecionarArquivo: (options) => ipcRenderer.invoke("selecionar-arquivo", options),
  abrirArquivoLocal: (caminho) => ipcRenderer.invoke("abrir-arquivo-local", caminho),
  gerarRelatorioVistoriaPrevia: (dados) => ipcRenderer.invoke("gerar-relatorio-vistoria-previa", dados),
  gerarPropostaAssessoriaLaudos: (dados) => ipcRenderer.invoke("gerar-proposta-assessoria-laudos", dados),
  gerarLaudosLote: (payload) => ipcRenderer.invoke("gerar-laudos-lote", payload),
  // Gatilho para o botão manual
  sincronizarEmails: () => ipcRenderer.invoke("forcar-sincronizacao"),
  onWhatsAppQR: (callback) => {
    const listener = (_event, qr) => callback(qr);
    ipcRenderer.on("whatsapp-qr", listener);
    return () => ipcRenderer.removeListener("whatsapp-qr", listener);
  },
  onInboxProgresso: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("inbox-progresso", listener);
    return () => ipcRenderer.removeListener("inbox-progresso", listener);
  },
  // Novo: Ouvinte para mensagens de log (ERRO ou SUCESSO)
  onInboxLog: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on("inbox-log", listener);
    return () => ipcRenderer.removeListener("inbox-log", listener);
  },
  onRefreshInbox: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("refresh-inbox", listener);
    return () => ipcRenderer.removeListener("refresh-inbox", listener);
  }
});
