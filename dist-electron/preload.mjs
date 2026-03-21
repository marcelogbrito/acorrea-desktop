"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("acorreaAPI", {
  executarPyCad: (payload) => electron.ipcRenderer.invoke("executar-pycad", payload),
  abrirGinfes: (credentials) => electron.ipcRenderer.invoke("executar-robo-ginfes", credentials),
  encryptPassword: (password) => electron.ipcRenderer.invoke("encrypt-password", password),
  selecionarArquivo: (options) => electron.ipcRenderer.invoke("selecionar-arquivo", options),
  abrirArquivoLocal: (caminho) => electron.ipcRenderer.invoke("abrir-arquivo-local", caminho),
  gerarRelatorioVistoriaPrevia: (dados) => electron.ipcRenderer.invoke("gerar-relatorio-vistoria-previa", dados),
  gerarPropostaAssessoriaLaudos: (dados) => electron.ipcRenderer.invoke("gerar-proposta-assessoria-laudos", dados),
  gerarLaudosLote: (payload) => electron.ipcRenderer.invoke("gerar-laudos-lote", payload),
  sincronizarEmails: () => electron.ipcRenderer.invoke("forcar-sincronizacao"),
  onWhatsAppQR: (callback) => {
    const listener = (_event, qr) => callback(qr);
    electron.ipcRenderer.on("whatsapp-qr", listener);
    return () => electron.ipcRenderer.removeListener("whatsapp-qr", listener);
  },
  onInboxProgresso: (callback) => {
    const listener = (_event, value) => callback(value);
    electron.ipcRenderer.on("inbox-progresso", listener);
    return () => electron.ipcRenderer.removeListener("inbox-progresso", listener);
  },
  onInboxLog: (callback) => {
    const listener = (_event, msg) => callback(msg);
    electron.ipcRenderer.on("inbox-log", listener);
    return () => electron.ipcRenderer.removeListener("inbox-log", listener);
  },
  onRefreshInbox: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("refresh-inbox", listener);
    return () => electron.ipcRenderer.removeListener("refresh-inbox", listener);
  }
});
