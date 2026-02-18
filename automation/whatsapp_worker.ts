import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { createClient } from '@supabase/supabase-js';

// Importamos os tipos separadamente apenas para a tipagem do código
// O 'type' antes do import garante que isso não vire código JavaScript no final
import type { Message, Contact } from 'whatsapp-web.js';

// Aqui está o segredo: tipamos como 'any' para o valor, 
// mas usamos o nome da classe para a instância
let wpClient: any; 

export function iniciarWhatsApp(win: any, supabaseUrl: string, serviceKey: string) {
  const supabase = createClient(supabaseUrl, serviceKey);

  wpClient = new Client({
    authStrategy: new LocalAuth({
        clientId: "acorrea-gestao"
    }),
    puppeteer: { 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
  });

  // Tipamos o 'qr' como string
  wpClient.on('qr', (qr: string) => {
    win.webContents.send('whatsapp-qr', qr);
    console.log('QR Code gerado para o WhatsApp');
  });

  wpClient.on('ready', () => {
    win.webContents.send('inbox-log', '✅ WhatsApp Conectado!');
  });

  // Tipamos a 'msg' com a interface Message da biblioteca
  wpClient.on('message', async (msg: Message) => {
    try {
      const contato: Contact = await msg.getContact();
      const telefone = contato.number;

      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .or(`telefone.ilike.%${telefone}%`) 
        .maybeSingle();

      await supabase.from('comunicacoes').insert({
        tipo: 'whatsapp',
        direcao: 'entrada',
        remetente_nome: contato.pushname || contato.name || 'Desconhecido',
        remetente_identificador: telefone,
        conteudo: msg.body,
        data_hora: new Date(),
        message_id_externo: msg.id.id,
        cliente_id: cliente?.id || null,
        tags: [cliente ? 'cliente_identificado' : 'pendente_vinculo']
      });
      console.log("Notificando frontend de nova mensagem...");
win.webContents.send('refresh-inbox');

      win.webContents.send('refresh-inbox');
    } catch (err: any) { // Tipamos o 'err' como any
      console.error('Erro ao processar mensagem WA:', err);
    }
  });

  wpClient.initialize().catch((err: any) => console.error("Erro ao iniciar WA:", err));
}

export async function enviarMensagemWhatsApp(telefone: string, texto: string) {
  if (!wpClient) throw new Error("WhatsApp não iniciado");
  const chatId = telefone.includes('@c.us') ? telefone : `${telefone}@c.us`;
  return await wpClient.sendMessage(chatId, texto);
}