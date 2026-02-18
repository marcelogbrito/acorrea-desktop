import { app, BrowserWindow, ipcMain, safeStorage, dialog, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { processarEmails } from '../automation/email_worker';

// Configuração de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Variáveis do Supabase (Recomendado usar .env no futuro)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(process.env.DIST || '', 'index.html'));
}

// ==========================================
// 1. UTILITÁRIOS DE CRIPTOGRAFIA
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
// 2. SINCRONIZAÇÃO DE INBOX (E-MAILS)
// ==========================================

async function sincronizarInbox() {
  try {
    const { data: creds } = await supabase
      .from('credenciais_servicos')
      .select('*')
      .eq('servico', 'inbox_email')
      .single();

    if (creds && creds.senha_hash) {
      const senhaReal = decryptPassword(creds.senha_hash);
      
      // Chamada para o worker com callback de progresso
      await processarEmails(
        { usuario: creds.usuario, senha_descriptografada: senhaReal },
        SUPABASE_URL,
        SUPABASE_KEY,
        (atual, total) => {
          // ENVIA PARA O FRONTEND
          win?.webContents.send('inbox-progresso', { atual, total });
        }
      );
    }
  } catch (e) {
    console.error("Erro na sincronização:", e);
  }
}

// ==========================================
// 3. AUTOMAÇÃO FINANCEIRA (GINFES)
// ==========================================

ipcMain.handle('executar-robo-ginfes', async (_, credentials) => {
  const { usuario, senha_hash, clienteCnpj, valorNota, descricaoServico } = credentials;
  const senhaReal = decryptPassword(senha_hash);

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await browser.newPage();

  try {
    await page.goto('https://santoandre.ginfes.com.br/', { waitUntil: 'networkidle' });

    // Login e Popups
    const okButton = page.getByRole('button', { name: 'OK' });
    try { await okButton.waitFor({ state: 'visible', timeout: 3000 }); await okButton.click(); } catch (e) {}

    await page.click('img[alt="Acesso Exclusivo Prestador"]');
    await page.locator('input[type="text"]:visible').first().fill(usuario);
    await page.locator('input[type="password"]:visible').first().fill(senhaReal);
    await page.locator('.x-btn:has-text("Entrar")').first().click();

    // Navegação para Emissão
    const btnEmitir = page.locator('div.gwt-PushButton:has(img[src*="icon_nfse3.gif"])').first();
    await btnEmitir.waitFor({ state: 'visible' });
    await btnEmitir.click();

    // Lógica resiliente de CNPJ (Frames)
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

    // Avançar e Preencher Serviços
    const btnProx = page.locator('button:has-text("Próximo Passo")').first();
    await btnProx.waitFor({ state: 'visible' });
    await btnProx.click();

    // Aba de Serviços (17.02 e Alíquota)
    await page.locator('input.cbTextAlign:visible').first().click();
    await page.locator('.x-combo-list-item:has-text("17.02")').first().click();

    // Descrição e Valor
    await page.locator('textarea.x-form-textarea:visible').fill(descricaoServico || '');
    const vInput = page.locator('input.alinhaValores:visible').first();
    await vInput.fill(valorNota || '0,00');
    await vInput.dispatchEvent('blur');

    return "Preenchimento concluído! Revise o resumo no navegador.";
  } catch (error: any) {
    return `Erro no robô: ${error.message}`;
  }
});

// ==========================================
// 4. AUTOMAÇÃO ENGENHARIA (AUTOCAD)
// ==========================================

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

// ==========================================
// 5. SELEÇÃO E ABERTURA DE ARQUIVOS
// ==========================================

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

// ==========================================
// INICIALIZAÇÃO DO APP
// ==========================================

app.whenReady().then(() => {
  createWindow();
  // Inicia sincronização após 1 minuto e repete a cada 10
  setTimeout(sincronizarInbox, 60000);
  setInterval(sincronizarInbox, 10 * 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});