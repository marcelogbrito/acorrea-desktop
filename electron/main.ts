import { app, BrowserWindow, ipcMain, safeStorage, dialog, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pkg from '../package.json'; // Puxa a versão atual do seu package.json

// Importação dos Workers de Automação
import { processarEmails } from '../automation/email_worker';
import { iniciarWhatsApp, enviarMensagemWhatsApp } from '../automation/whatsapp_worker';
import { gerarRelatorioVistoriaPrevia } from '../automation/report_worker';
import { compareVersions } from 'compare-versions';

// Configuração de diretórios
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração Supabase com Service Role Key para o Backend (Main Process)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada no .env");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

async function verificarVersao(win: BrowserWindow) {
  try {
    const versionAtual = pkg.version;

    // Busca a versão mais recente no banco
    const { data: latest, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latest) return;

    // Se a versão do banco for maior que a atual
    if (compareVersions(latest.version, versionAtual) === 1) {
      
      if (latest.obrigatoria) {
        // VERSÃO OBRIGATÓRIA
        await dialog.showMessageBox(win, {
          type: 'error',
          title: 'Atualização Obrigatória',
          message: `A versão ${latest.version} é obrigatória. O sistema será fechado para atualização.`,
          buttons: ['Baixar Agora']
        });
        shell.openExternal(latest.url);
        app.quit(); // Força o fechamento
      } else {
        // VERSÃO OPCIONAL
        const { response } = await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Nova Versão Disponível',
          message: `Uma nova versão (${latest.version}) está disponível. Deseja baixar agora?`,
          buttons: ['Sim, baixar', 'Lembrar mais tarde']
        });

        if (response === 0) {
          shell.openExternal(latest.url);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao verificar versão:", err);
  }
}

// ==========================================
// 1. UTILITÁRIOS E SEGURANÇA
// ==========================================

const decryptPassword = (encryptedBase64: string) => {
  const buffer = Buffer.from(encryptedBase64, 'base64');
  return safeStorage.decryptString(buffer);
};

ipcMain.handle('encrypt-password', async (_, password) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Criptografia indisponível');
  return safeStorage.encryptString(password).toString('base64');
});

// ==========================================
// 2. SINCRONIZAÇÃO E COMUNICAÇÃO (INBOX)
// ==========================================

async function sincronizarInbox() {
  try {
    win?.webContents.send('inbox-log', 'Iniciando conexão com Locaweb...');
    
    const { data: creds, error } = await supabase
      .from('credenciais_servicos')
      .select('*')
      .eq('servico', 'inbox_email')
      .single();

    if (error || !creds) {
      win?.webContents.send('inbox-log', 'Erro: Credenciais de e-mail não localizadas.');
      return;
    }

    const senhaReal = decryptPassword(creds.senha_hash);
    win?.webContents.send('inbox-log', 'Autenticando e-mail...');
    
    await processarEmails(
      { usuario: creds.usuario, senha_descriptografada: senhaReal },
      SUPABASE_URL,
      SERVICE_KEY,
      (atual, total) => {
        win?.webContents.send('inbox-progresso', { atual, total });
      }
    );

    win?.webContents.send('inbox-log', 'Sincronização de e-mails concluída!');
    win?.webContents.send('refresh-inbox'); // Avisa o React para recarregar a lista
  } catch (e: any) {
    win?.webContents.send('inbox-log', `Erro crítico: ${e.message}`);
    console.error(e);
  }
}

// Handler para o botão manual do Inbox
ipcMain.handle('forcar-sincronizacao', async () => {
  await sincronizarInbox();
  return { success: true };
});

// Handlers do WhatsApp
ipcMain.handle('enviar-whatsapp', async (_, { telefone, mensagem }) => {
  try {
    return await enviarMensagemWhatsApp(telefone, mensagem);
  } catch (err: any) {
    console.error("Erro ao enviar WhatsApp:", err.message);
    throw err;
  }
});

// ==========================================
// 3. AUTOMAÇÃO FINANCEIRA E ENGENHARIA
// ==========================================

ipcMain.handle('executar-robo-ginfes', async (_, credentials) => {
  const { usuario, senha_hash, clienteCnpj, valorNota, descricaoServico } = credentials;
  const senhaReal = decryptPassword(senha_hash);
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await browser.newPage();

  try {
    await page.goto('https://santoandre.ginfes.com.br/', { waitUntil: 'networkidle' });
    const okButton = page.getByRole('button', { name: 'OK' });
    try { await okButton.waitFor({ state: 'visible', timeout: 3000 }); await okButton.click(); } catch (e) {}

    await page.click('img[alt="Acesso Exclusivo Prestador"]');
    await page.locator('input[type="text"]:visible').first().fill(usuario);
    await page.locator('input[type="password"]:visible').first().fill(senhaReal);
    await page.locator('.x-btn:has-text("Entrar")').first().click();

    const btnEmitir = page.locator('div.gwt-PushButton:has(img[src*="icon_nfse3.gif"])').first();
    await btnEmitir.waitFor({ state: 'visible' });
    await btnEmitir.click();

    await page.waitForTimeout(2000);
    let cnpjInput = null;
    for (const frame of page.frames()) {
      const el = frame.locator('input[name*="cnpj"]:visible').first();
      if (await el.isVisible()) { cnpjInput = el; break; }
    }

    if (cnpjInput) {
      await cnpjInput.fill(clienteCnpj || '');
      const parent = cnpjInput.page() || page;
      await parent.locator('button:has-text("Pesquisar")').first().click();
    }

    const btnProx = page.locator('button:has-text("Próximo Passo")').first();
    await btnProx.waitFor({ state: 'visible' });
    await btnProx.click();

    await page.locator('input.cbTextAlign:visible').first().click();
    await page.locator('.x-combo-list-item:has-text("17.02")').first().click();

    await page.locator('textarea.x-form-textarea:visible').fill(descricaoServico || '');
    const vInput = page.locator('input.alinhaValores:visible').first();
    await vInput.fill(valorNota || '0,00');
    await vInput.dispatchEvent('blur');

    return "Preenchimento concluído! Revise o resumo no navegador.";
  } catch (error: any) {
    return `Erro no robô: ${error.message}`;
  }
});

ipcMain.handle('executar-pycad', async (_, payload) => {
  return new Promise((resolve, reject) => {
    const { dadosEquipamentos } = payload;
    const tempPath = path.join(__dirname, 'temp_dados.json');
    fs.writeFileSync(tempPath, JSON.stringify(dadosEquipamentos));

    const scriptPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'automation', 'pycad_worker.py') 
      : path.join(__dirname, '..', 'automation', 'pycad_worker.py'); 

    const command = `python "${scriptPath}" "${tempPath}"`;

    exec(command, (error, stdout) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (error) reject(error);
      else resolve({ success: true, log: stdout, resumo: dadosEquipamentos });
    });
  });
});

ipcMain.handle('selecionar-arquivo', async (_, options) => {
  const result = await dialog.showOpenDialog({
    title: options.title,
    properties: ['openFile'],
    filters: [{ name: 'Desenhos AutoCAD', extensions: options.extensions }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('abrir-arquivo-local', async (_, caminho) => {
  shell.openPath(caminho);
});

ipcMain.handle('gerar-relatorio-vistoria-previa', async (_, { vistoriaId }) => {
  try {
    const templatePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'templates', 'modelo_vistoria_previa.docx') 
      : path.join(__dirname, '..', 'resources', 'templates', 'modelo_vistoria_previa.docx');

    // Salva na pasta Downloads com o nome da vistoria (se quiser pode buscar o nome do prédio antes)
    const nomeArquivo = `Relatorio_Vistoria_${vistoriaId}_${new Date().getTime()}.docx`;
    const outputPath = path.join(app.getPath('downloads'), nomeArquivo);

    await gerarRelatorioVistoriaPrevia(
      vistoriaId,
      templatePath,
      outputPath,
      SUPABASE_URL,
      SERVICE_KEY
    );

    // Abre o arquivo automaticamente
    shell.openPath(outputPath);

    return { success: true };
  } catch (err: any) {
    console.error("Erro Relatório:", err);
    throw err;
  }
});

// ==========================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================

app.whenReady().then(() => {
  createWindow();
  verificarVersao(win!);

  // Inicia o WhatsApp Worker (QR Code e Recebimento)
  iniciarWhatsApp(win, SUPABASE_URL, SERVICE_KEY);

  // Inicia sincronização de e-mails após 1 minuto e repete a cada 10
  setTimeout(sincronizarInbox, 60000);
  setInterval(sincronizarInbox, 10 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});