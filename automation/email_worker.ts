import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

interface EmailConfig {
  usuario: string;
  senha_descriptografada: string;
}

// Lógica de prioridade idêntica ao seu código Go
function calcularPrioridade(dataEmail: Date | undefined): 'ALTA' | 'MÉDIA' | 'BAIXA' {
  if (!dataEmail) return 'BAIXA';
  const diffDays = Math.floor((new Date().getTime() - dataEmail.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 7) return 'ALTA';
  if (diffDays > 3) return 'MÉDIA';
  return 'BAIXA';
}

export async function processarEmails(
  config: EmailConfig, 
  supabaseUrl: string, 
  supabaseKey: string,
  onProgress?: (atual: number, total: number) => void
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const imapConfig = {
    imap: {
      user: config.usuario,
      password: config.senha_descriptografada,
      host: 'email-ssl.com.br',
      port: 993,
      tls: true,
      tlsOptions: { 
        rejectUnauthorized: false, 
        servername: 'email-ssl.com.br' // IDÊNTICO AO GO
      },
      authTimeout: 10000
    }
  };

  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');

    const diasAnalisar = 90;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasAnalisar);
    
    const searchCriteria = [['SINCE', dataLimite.toISOString()]]; 
    const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: false };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    const total = messages.length;
    
    console.log(`📩 Iniciando análise de ${total} e-mails...`);

    let processados = 0;
    for (const item of messages) {
  processados++;
  //console.log(`Processando e-mail ${processados} de ${total}...`); // ADICIONE ISSO
  
  if (onProgress) onProgress(processados, total);

      const allPart = item.parts.find((part: any) => part.which === '');
      if (!allPart) continue;

      const parsed = await simpleParser(allPart.body);
      const emailRemetente = parsed.from?.value?.[0].address?.toLowerCase() || '';

      // ADAPTAÇÃO GO: Ignora e-mails enviados pela própria empresa (@acorrea.com.br)
      if (emailRemetente.endsWith('@acorrea.com.br')) {
        continue;
      }

      const prioridade = calcularPrioridade(parsed.date);

      // Busca automática de cliente para vínculo inteligente
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .ilike('email', emailRemetente)
        .single();

      // Upsert no Supabase usando o messageId como chave única (evita duplicados)
      await supabase.from('comunicacoes').upsert({
        message_id_externo: parsed.messageId,
        tipo: 'email',
        direcao: 'entrada',
        remetente_nome: parsed.from?.value?.[0].name || 'Sem Nome',
        remetente_identificador: emailRemetente,
        assunto: parsed.subject || '(Sem Assunto)',
        conteudo: parsed.text?.substring(0, 1000) || '', // Limitado para performance
        data_hora: parsed.date || new Date(),
        cliente_id: cliente?.id || null,
        tags: [
          cliente ? 'cliente_identificado' : 'pendente_vinculo',
          prioridade
        ]
      }, { onConflict: 'message_id_externo' });
    }

    connection.end();
    return { success: true, count: total };
  } catch (err: any) {
    console.error('❌ Erro no Worker:', err.message);
    throw err;
  }
}