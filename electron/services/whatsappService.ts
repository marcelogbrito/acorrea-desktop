import { Client, LocalAuth } from 'whatsapp-web.js';
import { supabase } from 'src/lib/supabase';

let wpClient: Client;

export function iniciarWhatsApp() {
  wpClient = new Client({
    authStrategy: new LocalAuth(), // Salva a sessão localmente para não ler QR Code sempre
    puppeteer: { 
      headless: true, // Roda em background
      args: ['--no-sandbox'] 
    }
  });

  wpClient.on('qr', (qr) => {
    // Envia QR code para o Frontend React exibir na tela de Configurações
    // window.webContents.send('whatsapp-qr', qr); 
    console.log('QR RECEIVED', qr);
  });

  wpClient.on('ready', () => {
    console.log('WhatsApp Conectado!');
  });

  wpClient.on('message', async (msg) => {
    const contato = await msg.getContact();
    const telefone = contato.number; // ex: 5511999999999
    
    // Tenta encontrar cliente pelo telefone (limpando caracteres)
    const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .or(`telefone.eq.${telefone}, telefone.eq.+${telefone}`) 
        .single();

    // Salva mensagem no banco
    await supabase.from('comunicacoes').insert({
      tipo: 'whatsapp',
      direcao: 'entrada',
      remetente_nome: contato.pushname || contato.name,
      remetente_identificador: telefone,
      conteudo: msg.body,
      data_hora: new Date(),
      message_id_externo: msg.id.id,
      cliente_id: cliente?.id || null
    });
  });

  wpClient.initialize();
}

export async function enviarMensagemWhatsApp(telefone: string, texto: string) {
    // Função para ser chamada pelo Frontend
    const chatId = telefone.includes('@c.us') ? telefone : `${telefone}@c.us`;
    await wpClient.sendMessage(chatId, texto);
}