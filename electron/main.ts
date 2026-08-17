//electron/main.ts
import { app, BrowserWindow, ipcMain, safeStorage, dialog, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { exec, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import pkg from '../package.json';
import { compareVersions } from 'compare-versions';
import { machineIdSync } from 'node-machine-id';

// Importação dos Workers de Automação
import { processarEmails } from '../automation/email_worker';
import { iniciarWhatsApp, enviarMensagemWhatsApp } from '../automation/whatsapp_worker';
import { gerarRelatorioVistoriaPrevia } from '../automation/report_worker';
import { gerarPropostaAssessoriaLaudos } from '../automation/proposal_worker';
import { gerarLaudoWorker } from '../automation/laudo_worker';

// Configuração de diretórios
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identificação Única da Máquina
const myDeviceId = machineIdSync();

// Configuração Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  realtime: {
    transport: WebSocket as any
  }
});

let win: BrowserWindow | null = null;

// ==========================================
// 1. NÚCLEO DO SISTEMA E NAVEGAÇÃO
// ==========================================

async function garantirNavegador() {
  try {
    await chromium.launch({ channel: 'chrome' }).then(b => b.close());
    return 'chrome';
  } catch (e) {
    try {
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
    width: 1400,
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
      slowMo: 100, 
      channel: canal as any 
    });

    const page = await browser.newPage();
    await page.goto('https://santoandre.ginfes.com.br/', { waitUntil: 'networkidle' });

    // 🛠️ FUNÇÃO AUXILIAR 1: Varredura Agressiva de Popups
    const varrerPopups = async () => {
      try {
        const botoesOK = page.locator('button:has-text("OK"):visible');
        const count = await botoesOK.count();
        if (count > 0) {
          await botoesOK.last().click({ force: true });
          await page.waitForTimeout(800);
        }
      } catch (e) {}
      // ESC quebra a maioria das máscaras de bloqueio do ExtJS
      try { await page.keyboard.press('Escape'); } catch(e) {}
    };

    // 🛠️ FUNÇÃO AUXILIAR 2: Avançar Abas
    const clicarProximoPasso = async () => {
      const btnProx = page.locator('button:has-text("Próximo Passo"):visible').first();
      await btnProx.waitFor({ state: 'visible', timeout: 5000 });
      await btnProx.evaluate((node: HTMLButtonElement) => node.click());
      await page.waitForTimeout(1500); 
    };

    // --- LOGIN ---
    await varrerPopups(); 

    await page.click('img[alt="Acesso Exclusivo Prestador"]', { force: true });
    await page.locator('input[type="text"]:visible').first().fill(usuario);
    await page.locator('input[type="password"]:visible').first().fill(senhaReal);
    await page.locator('.x-btn:has-text("Entrar")').first().click();

    // ⏱️ ESPERA ESTRATÉGICA: Dá 4 segundos para o servidor "cuspir" os popups antes de tentarmos agir
    await page.waitForTimeout(4000); 

    // --- LOOP DE INSISTÊNCIA (Emitir -> Verificar Tomador) ---
    let inputCnpj = null;
    let btnPesquisar = null;
    let telaTomadorAberta = false;

    // Tenta 5 vezes furar o bloqueio da tela inicial
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      await varrerPopups(); // Limpa a tela antes de tentar
      await page.waitForTimeout(1000);

      try {
        const imgEmitir = page.locator('img[src*="icon_nfse3.gif"]').first();
        if (await imgEmitir.isVisible({ timeout: 2000 })) {
          await imgEmitir.hover({ force: true });
          await page.waitForTimeout(200);
          await imgEmitir.click({ force: true }); 
        }
      } catch (e) {}

      // Aguarda 3 segundos para o iframe de emissão carregar
      await page.waitForTimeout(3000); 

      // Varre todos os iframes procurando o título "Pesquisa Tomador"
      for (const frame of page.frames()) {
        const painelPesquisa = frame.locator('fieldset').filter({ hasText: 'Pesquisa Tomador' });
        if (await painelPesquisa.count() > 0) {
          inputCnpj = painelPesquisa.locator('input[type="text"]:visible').first();
          btnPesquisar = painelPesquisa.locator('button').filter({ hasText: 'Pesquisar' }).first();
          telaTomadorAberta = true;
          break;
        }
      }

      if (telaTomadorAberta) break; // Sucesso! Sai do loop.
    }

    if (!telaTomadorAberta || !inputCnpj || !btnPesquisar) {
      throw new Error("O portal Ginfes não respondeu ao clique de Emitir NFS-e (Travamento no servidor).");
    }

    // --- PASSO 1: PREENCHIMENTO TOMADOR ---
    await inputCnpj.waitFor({ state: 'visible', timeout: 5000 });
    await inputCnpj.click({ force: true });
    await page.waitForTimeout(300);
    await inputCnpj.fill(clienteCnpj || '');
    await page.waitForTimeout(1000); 
    await btnPesquisar.evaluate((node: HTMLButtonElement) => node.click()); 
    await page.waitForTimeout(3000); 

    await clicarProximoPasso();

    // --- PASSO 2: PREENCHIMENTO DO SERVIÇO ---
    try {
      const radioAtividade = page.locator('input.cbTextAlign:visible').first();
      if (await radioAtividade.isVisible()) {
        await radioAtividade.evaluate((node: HTMLElement) => node.click());
        await page.locator('.x-combo-list-item:has-text("17.02")').first().evaluate((node: HTMLElement) => node.click());
        await page.waitForTimeout(500);
      }
    } catch (e) {}

    const selecionarUltimaOpcaoCombo = async (labelTexto: string) => {
      try {
        const formItem = page.locator('.x-form-item').filter({ hasText: labelTexto });
        const inputCombo = formItem.locator('input.x-form-text').first();
        
        await inputCombo.evaluate((node: HTMLElement) => node.click()); 
        await page.waitForTimeout(800); 
        
        const listaAtiva = page.locator('.x-combo-list[style*="visibility: visible"]');
        const ultimaOpcao = listaAtiva.locator('.x-combo-list-item').last();
        
        await ultimaOpcao.evaluate((node: HTMLElement) => node.click());
        await page.waitForTimeout(400);
      } catch (e) {}
    };

    try {
      const inputAliquota = page.locator('.x-form-item').filter({ hasText: 'Aliquota (%)' }).locator('input.x-form-text:not([readonly])').first();
      await inputAliquota.evaluate((node: HTMLElement) => node.focus());
      await inputAliquota.fill('2');
    } catch (e) {}

    await selecionarUltimaOpcaoCombo('NBS');
    await selecionarUltimaOpcaoCombo('Código Indicador da Operação');
    await selecionarUltimaOpcaoCombo('Código de Situação Tributária');
    await selecionarUltimaOpcaoCombo('Classificacao Tributária');

    const textAreaDescricao = page.locator('textarea.x-form-textarea:visible').first();
    await textAreaDescricao.click({ force: true });
    await textAreaDescricao.fill(descricaoServico || '');
    await page.waitForTimeout(500);

    await clicarProximoPasso();

    // --- PASSO 3: VALOR DA NOTA ---
    await page.waitForTimeout(1500); 

    const valorParaDigitar = String(valorNota).replace(/\./g, '');

    const vInput = page.locator('input.alinhaValores:visible').first();
    await vInput.waitFor({ state: 'visible' });

    await vInput.evaluate((el: HTMLInputElement, val) => {
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('keydown', { bubbles: true }));
        el.dispatchEvent(new Event('keypress', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('keyup', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur(); 
    }, valorParaDigitar);

    await page.waitForTimeout(1500);
    await varrerPopups();

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

    exec(`py "${scriptPath}" "${tempPath}"`, (error, stdout) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (error) reject(error);
      else resolve({ success: true, log: stdout });
    });
  });
});

ipcMain.handle('gerar-relatorio-vistoria-previa', async (_, { vistoriaId }) => {
  // <-- CORREÇÃO DA ROTA DO ARQUIVO AQUI: DE 'resources' PARA 'public' NO MODO DEV
  const templatePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'templates', 'modelo_vistoria_previa.docx') 
    : path.join(__dirname, '..', 'public', 'templates', 'modelo_vistoria_previa.docx');

  const outputPath = path.join(app.getPath('downloads'), `Relatorio_Vistoria_${vistoriaId}.docx`);
  await gerarRelatorioVistoriaPrevia(vistoriaId, templatePath, outputPath, SUPABASE_URL, SERVICE_KEY);
  shell.openPath(outputPath);
  return { success: true };
});

// ==========================================
// MÁQUINA DE GERAÇÃO DE PROPOSTAS COMERCIAIS
// ==========================================
ipcMain.handle('gerar-proposta-assessoria-laudos', async (_, dadosExportacao) => {
  try {
    let templateFileName = 'modelo_proposta_assessoria_laudos.docx';

    switch (dadosExportacao.titulo_proposta) {
      case "Proposta Adequações: Sinalização de Emergência":
        templateFileName = 'modelo_proposta_adequacoes_sinalizacao.docx';
        break;
      case "Proposta Adequações: Central de Alarme":
        templateFileName = 'modelo_proposta_adequacoes_central_alarme.docx';
        break;
      case "Proposta Adequações: Registro de Recalque":
        templateFileName = 'modelo_proposta_adequacoes_registro_recalque.docx';
        break;
      case "Proposta Adequações: Iluminação de Emergência":
        templateFileName = 'modelo_proposta_adequacoes_iluminacao.docx'; 
        break;
      case "Proposta Adequações: Bomba de Incêndio":
        templateFileName = 'modelo_proposta_adequacoes_bomba.docx'; 
        break;
      case "Proposta Adequações: Extintores":
        templateFileName = 'modelo_proposta_adequacoes_extintores.docx'; 
        break;
      case "Proposta Adequações: Andares e Escadarias":
        templateFileName = 'modelo_proposta_adequacoes_escadaria.docx'; 
        break;
    }

    // <-- CORREÇÃO DA ROTA DO ARQUIVO AQUI: DE 'resources' PARA 'public' NO MODO DEV
    const templatePath = app.isPackaged 
      ? path.join(process.resourcesPath, 'templates', templateFileName) 
      : path.join(__dirname, '..', 'public', 'templates', templateFileName);

    const dataFormatada = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    dadosExportacao.data_extenso = dataFormatada;

    if (dadosExportacao.endereco_cliente) {
      dadosExportacao.endereço_cliente = dadosExportacao.endereco_cliente;
    }

    const nomeAmigavel = dadosExportacao.nome_cliente.replace(/[^a-z0-9]/gi, '_');
    const prefixo = templateFileName.replace('.docx', '').replace('modelo_', '');
    const nomeArquivo = `${prefixo}_${nomeAmigavel}_${Date.now()}.docx`;
    const outputPath = path.join(app.getPath('downloads'), nomeArquivo);

    await gerarPropostaAssessoriaLaudos(dadosExportacao, templatePath, outputPath);

    shell.openPath(outputPath); 
    return { success: true };
  } catch (err: any) {
    console.error("Erro na Geração da Proposta:", err);
    throw err;
  }
});

// ==========================================
// MÁQUINA DE GERAÇÃO DE LAUDOS (EM LOTE)
// ==========================================
ipcMain.handle('gerar-laudos-lote', async (_, payload) => {
  const { cliente, laudosSelecionados, nr_rrt } = payload;

  try {
    const dataFormatada = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const dadosTemplate = {
      nome_cliente: String(cliente.nome).toUpperCase(),
      endereco_cliente: String(cliente.endereco).toUpperCase(),
      endereço_cliente: String(cliente.endereco).toUpperCase(), 
      data_extenso: dataFormatada,
      nr_rrt: nr_rrt || 'NÃO INFORMADO'
    };

    const arquivosGerados = [];
    const nomeAmigavel = cliente.nome.replace(/[^a-z0-9]/gi, '_');

    for (const laudo of laudosSelecionados) {
      
      // <-- CORREÇÃO DA ROTA DO ARQUIVO AQUI: DE 'resources' PARA 'public' NO MODO DEV
      const templatePath = app.isPackaged 
        ? path.join(process.resourcesPath, 'templates', laudo.arquivo) 
        : path.join(__dirname, '..', 'public', 'templates', laudo.arquivo);

      const nomeArquivo = `Atestado_${laudo.nome}_${nomeAmigavel}.docx`;
      const outputPath = path.join(app.getPath('downloads'), nomeArquivo);

      await gerarLaudoWorker(dadosTemplate, templatePath, outputPath);
      arquivosGerados.push(outputPath);
    }

    if (arquivosGerados.length > 0) {
      shell.showItemInFolder(arquivosGerados[0]);
    }

    return { success: true, quantidade: arquivosGerados.length };
  } catch (err: any) {
    console.error("Erro na geração de laudos:", err);
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