import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function TimelineComunicacao({ clienteId }: { clienteId?: string }) {
  const [msgs, setMsgs] = useState<any[]>([]);

  useEffect(() => {
    buscarMensagens();
    
    // Realtime: Escuta novas mensagens chegando
    const channel = supabase
      .channel('comms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comunicacoes' }, 
        (payload) => {
           if (!clienteId || payload.new.cliente_id === clienteId) {
             setMsgs(prev => [payload.new, ...prev]);
           }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel) }
  }, [clienteId]);

  async function buscarMensagens() {
    let query = supabase
      .from('comunicacoes')
      .select('*')
      .order('data_hora', { ascending: false });

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data } = await query;
    setMsgs(data || []);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '500px', overflowY: 'auto' }}>
      {msgs.map(msg => (
        <div key={msg.id} style={{
          alignSelf: msg.direcao === 'entrada' ? 'flex-start' : 'flex-end',
          backgroundColor: msg.tipo === 'whatsapp' ? '#dcf8c6' : '#f5f5f5',
          border: msg.tipo === 'email' ? '1px solid #ddd' : 'none',
          padding: '10px',
          borderRadius: '8px',
          maxWidth: '80%',
          position: 'relative'
        }}>
          {/* Cabeçalho */}
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            {msg.tipo === 'email' ? '📧 Email' : '📱 WhatsApp'} 
            <span>| {new Date(msg.data_hora).toLocaleString()}</span>
            <span>| De: {msg.remetente_nome || msg.remetente_identificador}</span>
          </div>

          {/* Assunto (só email) */}
          {msg.assunto && <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{msg.assunto}</div>}

          {/* Conteúdo */}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>
            {msg.conteudo}
          </div>
        </div>
      ))}
    </div>
  );
}