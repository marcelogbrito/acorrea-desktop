import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function NovaVistoriaModal({ clienteId, onClose, onSuccess }: any) {
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [nomeEdificacao, setNomeEdificacao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!dataAgendamento || !nomeEdificacao) return alert("Preencha os campos obrigatórios");
    setLoading(true);

    try {
      // 1. Cria a Vistoria
      const { data: vistoria, error } = await supabase
        .from('vistoria_previa_avcb')
        .insert({
          cliente_id: clienteId,
          data_agendamento: new Date(dataAgendamento).toISOString(),
          nome_edificacao: nomeEdificacao,
          endereco_edificacao: endereco,
          situacao: 'agendada'
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Cria o Checklist Vazio vinculado (CRUCIAL)
      await supabase.from('checklist_vistoria_avcb').insert({
        vistoria_previa_id: vistoria.id
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Erro ao criar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>Nova Vistoria Prévia</h3>
        
        <label>Data do Agendamento *</label>
        <input type="datetime-local" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} style={inputStyle} />

        <label>Nome da Edificação *</label>
        <input value={nomeEdificacao} onChange={e => setNomeEdificacao(e.target.value)} style={inputStyle} placeholder="Ex: Edifício Top One" />

        <label>Endereço</label>
        <input value={endereco} onChange={e => setEndereco(e.target.value)} style={inputStyle} placeholder="Rua..." />

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancelar</button>
          <button onClick={handleSalvar} disabled={loading} style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px' }}>
            {loading ? 'Criando...' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle = { background: 'white', padding: '25px', borderRadius: '8px', width: '400px', display: 'flex', flexDirection: 'column' as 'column', gap: '10px' };
const inputStyle = { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' };