import { app, BrowserWindow, ipcMain, safeStorage, dialog, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { exec, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pkg from '../package.json';
import { compareVersions } from 'compare-versions';
import { machineIdSync } from 'node-machine-id';

// Importação dos Workers de Automação
import { processarEmails } from '../automation/email_worker';
import { iniciarWhatsApp, enviarMensagemWhatsApp } from '../automation/whatsapp_worker';
import { gerarRelatorioVistoriaPrevia } from '../automation/report_worker';
import { gerarPropostaAssessoriaLaudos } from '../automation/proposal_worker';

// Configuração de diretórios
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identificação Única da Máquina (Para Criptografia Multi-máquina)
const myDeviceId = machineIdSync();

// Configuração Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

let win: BrowserWindow | null = null;

// ==========================================
// 1. NÚCLEO DO SISTEMA E NAVEGAÇÃO
// ==========================================

async function garantirNavegador() {
  try {
    // Tenta validar se o Chrome está disponível (canal mais estável para usuários finais)
    await chromium.launch({ channel: 'chrome' }).then(b => b.close());
    return 'chrome';
  } catch (e) {
    try {
      // Fallback: Tenta baixar o Chromium silenciosamente se não houver Chrome
      console.log("Instalando dependências de navegação...");
      execSync('npx playwright install chromium');
      return undefined; 
    } catch (err) {
      console.error("Falha ao preparar navegador:", err);
      return 'chrome'; 
    }
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, // Aumente o padrão inicial
  height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.maximize();

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function verificarVersao(windowObj: BrowserWindow) {
  try {
    const { data: latest, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latest) return;

    if (compareVersions(latest.version, pkg.version) === 1) {
      if (latest.obrigatoria) {
        await dialog.showMessageBox(windowObj, {
          type: 'error',
          title: 'Atualização Obrigatória',
          message: `A versão ${latest.version} é obrigatória para o funcionamento da automação.`,
          buttons: ['Baixar Agora']
        });
        shell.openExternal(latest.url);
        app.quit();
      } else {
        const { response } = await dialog.showMessageBox(windowObj, {
          type: 'info',
          title: 'Nova Versão Disponível',
          message: `Uma nova versão (${latest.version}) está disponível. Deseja baixar?`,
          buttons: ['Sim', 'Depois']
        });
        if (response === 0) shell.openExternal(latest.url);
      }
    }
  } catch (err) { console.error("Erro check version:", err); }
}

// ==========================================
// 2. UTILITÁRIOS E SEGURANÇA (COFRE)
// ==========================================

const decryptPassword = (encryptedBase64: string) => {
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (e) {
    throw new Error("❌ Erro de Criptografia: Esta senha foi cadastrada em outra máquina.");
  }
};

ipcMain.handle('encrypt-password', async (_, password) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Criptografia indisponível');
  return safeStorage.encryptString(password).toString('base64');
});

ipcMain.handle('salvar-credencial', async (_, { servico, usuario, senhaLimpa }) => {
  const senha_hash = safeStorage.encryptString(senhaLimpa).toString('base64');
  const { error } = await supabase.from('credenciais_servicos').upsert({ 
    servico, usuario, senha_hash, device_id: myDeviceId 
  }, { onConflict: 'servico, device_id' });
  return !error;
});

// ==========================================
// 3. AUTOMAÇÃO FINANCEIRA (GINFES)
// ==========================================

ipcMain.handle('executar-robo-ginfes', async (_, credentials) => {
  const { usuario, senha_hash, clienteCnpj, valorNota, descricaoServico } = credentials;
  
  try {
    const senhaReal = decryptPassword(senha_hash);
    const canal = await garantirNavegador();

    const browser = await chromium.launch({ 
      headless: false, 
      slowMo: 150,
      channel: canal as any 
    });

    const page = await browser.newPage();
    await page.goto('https://santoandre.ginfes.com.br/', { waitUntil: 'networkidle' });

    // Fecha popup inicial
    const okButton = page.getByRole('button', { name: 'OK' });
    try { await okButton.waitFor({ state: 'visible', timeout: 3000 }); await okButton.click(); } catch (e) {}

    // Login
    await page.click('img[alt="Acesso Exclusivo Prestador"]');
    await page.locator('input[type="text"]:visible').first().fill(usuario);
    await page.locator('input[type="password"]:visible').first().fill(senhaReal);
    await page.locator('.x-btn:has-text("Entrar")').first().click();

    // Navega para Emissão
    const btnEmitir = page.locator('div.gwt-PushButton:has(img[src*="icon_nfse3.gif"])').first();
    await btnEmitir.waitFor({ state: 'visible' });
    await btnEmitir.click();

    await page.waitForTimeout(2000);
    
    // Identifica frame do CNPJ
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

    // Serviço e Valores
    await page.locator('input.cbTextAlign:visible').first().click();
    await page.locator('.x-combo-list-item:has-text("17.02")').first().click();
    await page.locator('textarea.x-form-textarea:visible').fill(descricaoServico || '');
    
    const vInput = page.locator('input.alinhaValores:visible').first();
    await vInput.click({ clickCount: 3 }); 
    await vInput.press('Backspace');
    await vInput.fill(valorNota); // Formato esperado pelo site (ex: 1.500,00)
    await vInput.dispatchEvent('blur');

    return "✅ Robô concluiu o preenchimento! Revise os dados e clique em 'Emitir'.";
  } catch (error: any) {
    return `❌ Erro no robô: ${error.message}`;
  }
});

// ==========================================
// 4. AUTOMAÇÃO DE EMAIL E WHATSAPP
// ==========================================

async function sincronizarInbox() {
  try {
    const { data: creds } = await supabase.from('credenciais_servicos')
      .select('*').eq('servico', 'inbox_email').eq('device_id', myDeviceId).single();

    if (!creds) return;
    const senhaReal = decryptPassword(creds.senha_hash);
    
    await processarEmails(
      { usuario: creds.usuario, senha_descriptografada: senhaReal },
      SUPABASE_URL, SERVICE_KEY,
      (atual, total) => { win?.webContents.send('inbox-progresso', { atual, total }); }
    );
    win?.webContents.send('refresh-inbox');
  } catch (e) { console.error("Erro sincronização:", e); }
}

ipcMain.handle('forcar-sincronizacao', async () => {
  await sincronizarInbox();
  return { success: true };
});

ipcMain.handle('enviar-whatsapp', async (_, { telefone, mensagem }) => {
  return await enviarMensagemWhatsApp(telefone, mensagem);
});

// ==========================================
// 5. ENGENHARIA E DOCUMENTOS
// ==========================================

ipcMain.handle('executar-pycad', async (_, payload) => {
  return new Promise((resolve, reject) => {
    const { dadosEquipamentos } = payload;
    const tempPath = path.join(__dirname, 'temp_dados.json');
    fs.writeFileSync(tempPath, JSON.stringify(dadosEquipamentos));

    const scriptPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'automation', 'pycad_worker.py') 
      : path.join(__dirname, '..', 'automation', 'pycad_worker.py'); 

    exec(`python "${scriptPath}" "${tempPath}"`, (error, stdout) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (error) reject(error);
      else resolve({ success: true, log: stdout });
    });
  });
});

ipcMain.handle('gerar-relatorio-vistoria-previa', async (_, { vistoriaId }) => {
  const templatePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'templates', 'modelo_vistoria_previa.docx') 
    : path.join(__dirname, '..', 'resources', 'templates', 'modelo_vistoria_previa.docx');

  const outputPath = path.join(app.getPath('downloads'), `Relatorio_Vistoria_${vistoriaId}.docx`);
  await gerarRelatorioVistoriaPrevia(vistoriaId, templatePath, outputPath, SUPABASE_URL, SERVICE_KEY);
  shell.openPath(outputPath);
  return { success: true };
});

ipcMain.handle('gerar-proposta-assessoria-laudos', async (_, dadosExportacao) => {
  try {
    const templatePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'templates', 'modelo_proposta_assessoria_laudos.docx') 
      : path.join(__dirname, '..', 'resources', 'templates', 'modelo_proposta_assessoria_laudos.docx');

    const nomeAmigavel = dadosExportacao.nome_cliente.replace(/[^a-z0-9]/gi, '_');
    const nomeArquivo = `Proposta_Assessoria_Laudos_${nomeAmigavel}_${Date.now()}.docx`;
    const outputPath = path.join(app.getPath('downloads'), nomeArquivo);

    await gerarPropostaAssessoriaLaudos(dadosExportacao, templatePath, outputPath);

    shell.openPath(outputPath); // Abre o Word para o usuário revisar
    return { success: true };
  } catch (err: any) {
    console.error("Erro na Proposta:", err);
    throw err;
  }
});

ipcMain.handle('selecionar-arquivo', async (_, options) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'AutoCAD', extensions: options.extensions }] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('abrir-arquivo-local', async (_, caminho) => { shell.openPath(caminho); });

// ==========================================
// INICIALIZAÇÃO
// ==========================================

app.whenReady().then(() => {
  createWindow();
  verificarVersao(win!);
  iniciarWhatsApp(win, SUPABASE_URL, SERVICE_KEY);

  setTimeout(sincronizarInbox, 30000);
  setInterval(sincronizarInbox, 15 * 60 * 1000); // 15 min
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });