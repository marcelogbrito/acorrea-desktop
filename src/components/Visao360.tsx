// src/components/Visao360.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FormularioCobranca } from './FormularioCobranca'
import { GerenciamentoProjetos } from './GerenciamentoProjetos'
import { NovaVistoriaModal } from './NovaVistoriaModal' 
import { VistoriaDetalhes } from './VistoriaDetalhes' 
import { ModalNovaProposta } from './ModalNovaProposta' 
import { ModalGeradorLaudos } from './ModalGeradorLaudos';

interface Visao360Props {
  cliente: any;
  onBack: () => void;
  onSolicitarEmissao: (cliente: any, dados: { valor: string, descricao: string, receitaId?: string }) => void;
}

export function Visao360({ cliente, onBack, onSolicitarEmissao }: Visao360Props) {
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'projetos'>('geral')
  const [vistorias, setVistorias] = useState<any[]>([])
  const [avcbAtivo, setAvcbAtivo] = useState<any>(null)
  const [notasFiscais, setNotasFiscais] = useState<any[]>([])
  const [contasAReceber, setContasAReceber] = useState<any[]>([])
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [parceirosDisponiveis, setParceirosDisponiveis] = useState<any[]>([])
  
  // Novos estados para Lembretes e OS
  const [lembretes, setLembretes] = useState<any[]>([])
  const [ordensServico, setOrdensServico] = useState<any[]>([])
  
  const [abrirNovaCobranca, setAbrirNovaCobranca] = useState(false)
  const [receitaEditando, setReceitaEditando] = useState<any>(null) 
  const [abrirNovaVistoria, setAbrirNovaVistoria] = useState(false)
  const [abrirNovaProposta, setAbrirNovaProposta] = useState(false) 
  const [orcamentoEditando, setOrcamentoEditando] = useState<any>(null) 
  const [vistoriaAbertaId, setVistoriaAbertaId] = useState<string | null>(null)
  
  const [subindoNotaId, setSubindoNotaId] = useState<string | null>(null)
  const [subindoBoletoId, setSubindoBoletoId] = useState<string | null>(null)
  const [editandoDados, setEditandoDados] = useState(false)
  const [dadosCliente, setDadosCliente] = useState(cliente)
  const [abrirGeradorLaudos, setAbrirGeradorLaudos] = useState(false);

  // Estados para Modais de CRUD (Lembretes e OS)
  const [abrirModalLembrete, setAbrirModalLembrete] = useState(false);
  const [lembreteForm, setLembreteForm] = useState({ id: '', titulo: '', descricao: '', data_lembrete: '', prioridade: 'media', concluido: false });

  const [abrirModalOs, setAbrirModalOs] = useState(false);
  const [osForm, setOsForm] = useState({ id: '', observacoes: '', data_hora_prevista: '', situacao: 'agendada' });

  useEffect(() => {
    loadClienteData()
    setDadosCliente(cliente)
  }, [cliente.id])

  async function loadClienteData() {
    setLoading(true)
    try {
      const [resVist, resAvcb, resNF, resRec, resOrc, resParceiros, resLemb, resOs] = await Promise.all([
        supabase.from('vistoria_previa_avcb').select('*, checklist_vistoria_avcb(*)').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
        supabase.from('avcbs_expedidas').select('*').eq('cliente_id', cliente.id).order('validade', { ascending: false }).limit(1),
        supabase.from('notas_fiscais').select('*, servicos(nome_servico)').eq('cliente_id', cliente.id).order('data_emissao', { ascending: false }),
        supabase.from('receitas').select('*').eq('cliente_id', cliente.id).order('data_vencimento', { ascending: true }),
        supabase.from('orcamentos').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
        supabase.from('clientes').select('id, nome').eq('parceiro', true),
        // Buscas adicionadas
        supabase.from('lembretes').select('*').eq('cliente_id', cliente.id).order('data_lembrete', { ascending: true }),
        supabase.from('ordens_de_servico').select('*').eq('cliente_id', cliente.id).order('data_hora_prevista', { ascending: true })
      ])
      
      setVistorias(resVist.data || [])
      setAvcbAtivo(resAvcb.data?.[0] || null)
      setNotasFiscais(resNF.data || [])
      setContasAReceber(resRec.data || [])
      setOrcamentos(resOrc.data || [])
      setParceirosDisponiveis(resParceiros.data || [])
      setLembretes(resLemb.data || [])
      setOrdensServico(resOs.data || [])
    } finally {
      setLoading(false)
    }
  }

  // ================= CRUD LEMBRETES =================
  const abrirFormLembrete = (lembrete?: any) => {
    if (lembrete) {
      setLembreteForm({
        id: lembrete.id,
        titulo: lembrete.titulo,
        descricao: lembrete.descricao || '',
        data_lembrete: lembrete.data_lembrete ? new Date(lembrete.data_lembrete).toISOString().slice(0, 16) : '',
        prioridade: lembrete.prioridade || 'media',
        concluido: lembrete.concluido
      });
    } else {
      setLembreteForm({ id: '', titulo: '', descricao: '', data_lembrete: '', prioridade: 'media', concluido: false });
    }
    setAbrirModalLembrete(true);
  }

  const salvarLembrete = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        cliente_id: cliente.id,
        titulo: lembreteForm.titulo,
        descricao: lembreteForm.descricao,
        data_lembrete: lembreteForm.data_lembrete || null,
        prioridade: lembreteForm.prioridade,
        concluido: lembreteForm.concluido
      };

      if (lembreteForm.id) {
        await supabase.from('lembretes').update(payload).eq('id', lembreteForm.id);
      } else {
        await supabase.from('lembretes').insert([payload]);
      }
      setAbrirModalLembrete(false);
      loadClienteData();
    } catch (err: any) { alert("Erro ao salvar lembrete: " + err.message); }
  }

  const excluirLembrete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este lembrete?")) return;
    await supabase.from('lembretes').delete().eq('id', id);
    loadClienteData();
  }

  const concluirLembrete = async (id: string, concluido: boolean) => {
    await supabase.from('lembretes').update({ concluido: !concluido }).eq('id', id);
    loadClienteData();
  }

  // ================= CRUD ORDENS DE SERVIÇO =================
  const abrirFormOs = (os?: any) => {
    if (os) {
      setOsForm({
        id: os.id,
        observacoes: os.observacoes || '',
        data_hora_prevista: os.data_hora_prevista ? new Date(os.data_hora_prevista).toISOString().slice(0, 16) : '',
        situacao: os.situacao || 'agendada'
      });
    } else {
      setOsForm({ id: '', observacoes: '', data_hora_prevista: '', situacao: 'agendada' });
    }
    setAbrirModalOs(true);
  }

  const salvarOs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        cliente_id: cliente.id,
        observacoes: osForm.observacoes,
        data_hora_prevista: osForm.data_hora_prevista || null,
        situacao: osForm.situacao
      };

      if (osForm.id) {
        await supabase.from('ordens_de_servico').update(payload).eq('id', osForm.id);
      } else {
        await supabase.from('ordens_de_servico').insert([payload]);
      }
      setAbrirModalOs(false);
      loadClienteData();
    } catch (err: any) { alert("Erro ao salvar OS: " + err.message); }
  }

  const excluirOs = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta O.S.?")) return;
    await supabase.from('ordens_de_servico').delete().eq('id', id);
    loadClienteData();
  }

  const alterarSituacaoOs = async (id: string, novaSituacao: string) => {
    await supabase.from('ordens_de_servico').update({ situacao: novaSituacao }).eq('id', id);
    loadClienteData();
  }

  // ================= MÉTODOS EXISTENTES =================
  const excluirOrcamento = async (id: string) => {
    if (!window.confirm("🗑️ Deseja realmente excluir esta proposta comercial permanentemente?")) return;
    try {
      const { error } = await supabase.from('orcamentos').delete().eq('id', id);
      if (error) throw error;
      loadClienteData();
    } catch (err: any) { alert("Erro ao excluir: " + err.message); }
  }

  const abrirEdicaoProposta = (orcamento: any) => {
    setOrcamentoEditando(orcamento);
    setAbrirNovaProposta(true);
  }

  const excluirReceita = async (id: string) => {
    if (!window.confirm("🗑️ Deseja realmente excluir esta cobrança?")) return;
    try {
      const { error } = await supabase.from('receitas').delete().eq('id', id);
      if (error) throw error;
      loadClienteData();
    } catch (err: any) { alert("Erro ao excluir: " + err.message); }
  }

  const alterarStatusReceita = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase.from('receitas').update({ situacao: novoStatus }).eq('id', id);
      if (error) throw error;
      loadClienteData();
    } catch (err: any) { alert("Erro ao atualizar: " + err.message); }
  }

  const salvarDadosGerais = async () => {
    try {
      const { error } = await supabase.from('clientes').update({
          nome: dadosCliente.nome,
          cnpj_cpf: dadosCliente.cnpj_cpf,
          endereco: dadosCliente.endereco,
          telefone: dadosCliente.telefone,
          email: dadosCliente.email,
          parceiro_id: dadosCliente.parceiro_id || null
        }).eq('id', cliente.id)
      if (error) throw error
      alert("✅ Dados do cliente updated!")
      setEditandoDados(false)
      loadClienteData()
    } catch (err: any) { alert("Erro ao atualizar: " + err.message) }
  }

  const dispararNFParaReceita = (receita: any) => {
    const confirmar = window.confirm(`Deseja iniciar a automação para a nota de R$ ${receita.valor_receber}?`);
    if (confirmar) {
      onSolicitarEmissao(cliente, {
        valor: Number(receita.valor_receber).toLocaleString('pt-BR'),
        descricao: receita.discriminacao_servicos,
        receitaId: receita.id
      });
    }
  }

  const handleUploadNota = async (nfId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setSubindoNotaId(nfId)
    try {
      const fileName = `${cliente.id}/nf_${nfId}_${Date.now()}.pdf`
      await supabase.storage.from('notas_fiscais').upload(fileName, file)
      await supabase.from('notas_fiscais').update({ file_path: fileName, situacao: 'Emitida' }).eq('id', nfId)
      loadClienteData()
    } catch (err: any) { alert(err.message) } finally { setSubindoNotaId(null) }
  }

  const handleUploadBoleto = async (receitaId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setSubindoBoletoId(receitaId)
    try {
      const fileName = `${cliente.id}/boleto_${receitaId}_${Date.now()}.pdf`
      await supabase.storage.from('boletos').upload(fileName, file)
      await supabase.from('receitas').update({ path_documento_cobranca: fileName }).eq('id', receitaId)
      loadClienteData()
    } catch (err: any) { alert(err.message) } finally { setSubindoBoletoId(null) }
  }

  const enviarWhatsApp = (receita: any) => {
    const nf = notasFiscais.find(n => n.receita_id === receita.id)
    const urlBoleto = receita.path_documento_cobranca ? supabase.storage.from('boletos').getPublicUrl(receita.path_documento_cobranca).data.publicUrl : null
    const urlNF = nf?.file_path ? supabase.storage.from('notas_fiscais').getPublicUrl(nf.file_path).data.publicUrl : null
    const msg = encodeURIComponent(`Olá! Segue a cobrança:\n*Serviço:* ${receita.discriminacao_servicos}\n*Valor:* R$ ${Number(receita.valor_receber).toLocaleString('pt-BR')}\n*Vencimento:* ${renderizarDataSegura(receita.data_vencimento)}${urlBoleto ? `\n*Boleto:* ${urlBoleto}` : ''}${urlNF ? `\n*NF:* ${urlNF}` : ''}`)
    window.open(`https://web.whatsapp.com/send?phone=55${cliente.telefone?.replace(/\D/g, '')}&text=${msg}`, '_blank')
  }

  const alterarSituacaoOrcamento = async (id: string, novaSituacao: string) => {
    const { error } = await supabase
      .from('orcamentos')
      .update({ situacao_orcamento: novaSituacao })
      .eq('id', id);
    
    if (error) return alert("Erro ao atualizar situação: " + error.message);

    if (novaSituacao === 'Aprovado') {
      const confirmar = window.confirm("Orçamento aprovado! Gerar lembrete de agendamento de vistoria?");
      if (confirmar) {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(9, 0, 0, 0); 

        const { error: errorLembrete } = await supabase
          .from('lembretes')
          .insert({
            cliente_id: cliente.id,
            titulo: `📞 Ligar para agendar Vistoria: ${dadosCliente.nome}`,
            descricao: `Orçamento aprovado em ${new Date().toLocaleDateString()}. Necessário agendar vistoria prévia.`,
            data_lembrete: amanha.toISOString(),
            prioridade: 'alta'
          });

        if (!errorLembrete) alert("✅ Lembrete registrado no sistema!");
      }
    }
    loadClienteData();
  };

  // ================= CRUD VISTORIAS (SITUAÇÃO) =================
  const alterarSituacaoVistoria = async (id: string, novaSituacao: string) => {
    try {
      const { error } = await supabase.from('vistoria_previa_avcb').update({ situacao: novaSituacao }).eq('id', id);
      if (error) throw error;
      loadClienteData();
    } catch (err: any) { alert("Erro ao atualizar situação: " + err.message); }
  }

  const renderizarDataSegura = (dataString: string) => {
    if (!dataString) return '';
    const dataLimpa = dataString.split('T')[0];
    const [ano, mes, dia] = dataLimpa.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formatarDateTime = (dataString: string) => {
    if (!dataString) return '';
    const d = new Date(dataString);
    return `${d.toLocaleDateString()} às ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  if (loading) return <div style={{ padding: '20px' }}>Carregando dados...</div>

  if (vistoriaAbertaId) {
    return <VistoriaDetalhes vistoriaId={vistoriaAbertaId} onBack={() => { setVistoriaAbertaId(null); loadClienteData(); }} />
  }

  return (
    <div style={containerStyle}>
      
      <div style={headerStyle}>
        <button onClick={onBack} style={btnBackStyle}>← Voltar para Lista</button>
        <h2 style={{ margin: 0 }}>🔍 Cliente: {dadosCliente.nome}</h2>
        <div style={{ ...avcbStatusStyle, backgroundColor: avcbAtivo ? '#d4edda' : '#f8d7da', color: avcbAtivo ? '#155724' : '#721c24' }}>
          {avcbAtivo ? `AVCB Vence: ${renderizarDataSegura(avcbAtivo.validade)}` : 'Sem AVCB Ativo'}
        </div>
      </div>

      <div style={tabsContainerStyle}>
        <button onClick={() => setAbaAtiva('geral')} style={abaAtiva === 'geral' ? activeSubTabStyle : subTabStyle}>📋 Administrativo / Financeiro</button>
        <button onClick={() => setAbaAtiva('projetos')} style={abaAtiva === 'projetos' ? activeSubTabStyle : subTabStyle}>📐 Projetos AutoCAD (PyCAD)</button>
      </div>

      {abaAtiva === 'geral' ? (
        <div style={mainGridStyle}>
          
          <div style={columnStyle}>
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>📋 Dados do Condomínio</h3>
                <button onClick={() => editandoDados ? salvarDadosGerais() : setEditandoDados(true)} style={editandoDados ? btnGreenStyle : btnViewStyle}>
                  {editandoDados ? 'Salvar Alterações' : 'Editar Dados'}
                </button>
              </div>

              <div style={formGridStyle}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={miniLabelStyle}>Nome</label>
                  <input disabled={!editandoDados} style={editandoDados ? inputEditableStyle : inputStaticStyle} value={dadosCliente.nome} onChange={e => setDadosCliente({...dadosCliente, nome: e.target.value})} />
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={miniLabelStyle}>Vínculo de Parceiro</label>
                  {editandoDados ? (
                    <select 
                      style={inputEditableStyle} 
                      value={dadosCliente.parceiro_id || ''} 
                      onChange={e => setDadosCliente({ ...dadosCliente, parceiro_id: e.target.value || null })}
                    >
                      <option value="">Atendimento Direto</option>
                      {parceirosDisponiveis.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ ...inputStaticStyle, padding: '8px 0' }}>
                      {dadosCliente.parceiro_id ? parceirosDisponiveis.find(p => p.id === dadosCliente.parceiro_id)?.nome || 'Direto' : 'Atendimento Direto'}
                    </div>
                  )}
                </div>

                <div>
                  <label style={miniLabelStyle}>CNPJ/CPF</label>
                  <input disabled={!editandoDados} style={editandoDados ? inputEditableStyle : inputStaticStyle} value={dadosCliente.cnpj_cpf} onChange={e => setDadosCliente({...dadosCliente, cnpj_cpf: e.target.value})} />
                </div>
                <div>
                  <label style={miniLabelStyle}>Telefone</label>
                  <input disabled={!editandoDados} style={editandoDados ? inputEditableStyle : inputStaticStyle} value={dadosCliente.telefone} onChange={e => setDadosCliente({...dadosCliente, telefone: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={miniLabelStyle}>Endereço</label>
                  <input disabled={!editandoDados} style={editandoDados ? inputEditableStyle : inputStaticStyle} value={dadosCliente.endereco} onChange={e => setDadosCliente({...dadosCliente, endereco: e.target.value})} />
                </div>
              </div>
            </section>

            {/* ------------ NOVA SEÇÃO: LEMBRETES ------------ */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🔔 Lembretes</h3>
                <button onClick={() => abrirFormLembrete()} style={btnGreenStyle}>+ Lembrete</button>
              </div>
              {lembretes.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhum lembrete pendente.</p>
              ) : (
                lembretes.map(l => (
                  <div key={l.id} style={{...itemStyle, opacity: l.concluido ? 0.5 : 1}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox" 
                        checked={l.concluido} 
                        onChange={() => concluirLembrete(l.id, l.concluido)} 
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, textDecoration: l.concluido ? 'line-through' : 'none' }}>
                        <div style={{ fontWeight: 'bold', color: '#1a3353' }}>{l.titulo}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{formatarDateTime(l.data_lembrete)} | Prioridade: {l.prioridade}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => abrirFormLembrete(l)} style={btnSmallStyle}>✏️</button>
                        <button onClick={() => excluirLembrete(l.id)} style={{...btnSmallStyle, color: '#dc3545'}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>💳 Contas a Receber</h3>
                <button onClick={() => { setReceitaEditando(null); setAbrirNovaCobranca(true); }} style={btnGreenStyle}>+ Cobrança</button>
              </div>
              {contasAReceber.map(r => {
                const nf = notasFiscais.find(n => n.receita_id === r.id)
                const temBoleto = !!r.path_documento_cobranca
                const temNota = !!nf?.file_path
                const pago = r.situacao === 'recebido' || r.situacao === 'recebido_em_atraso';
                return (
                  <div key={r.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold', color: pago ? 'green' : '#d9534f' }}>
                        {pago ? '✅' : '⏳'} {r.discriminacao_servicos}
                      </span>
                      <span style={{ fontSize: '11px' }}>{renderizarDataSegura(r.data_vencimento)}</span>
                    </div>
                    <div style={actionsRowStyle}>
                      <strong>R$ {Number(r.valor_receber).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!pago && <button onClick={() => { setReceitaEditando(r); setAbrirNovaCobranca(true); }} style={btnSmallStyle}>✏️</button>}
                        <button onClick={() => excluirReceita(r.id)} style={{...btnSmallStyle, color: 'red'}}>🗑️</button>
                        {!pago && <button onClick={() => alterarStatusReceita(r.id, 'recebido')} style={btnGreenStyle}>Baixa</button>}
                        {pago && <button onClick={() => alterarStatusReceita(r.id, 'a_receber')} style={btnSmallStyle}>Estornar</button>}
                        {!temNota && <button onClick={() => dispararNFParaReceita(r)} style={btnNFStyle}>Nota</button>}
                        {temBoleto ? (
                           <button onClick={() => window.open(supabase.storage.from('boletos').getPublicUrl(r.path_documento_cobranca).data.publicUrl, '_blank')} style={btnSmallStyle}>Boleto</button>
                        ) : (
                          <label style={btnUploadBoletoStyle}>
                            {subindoBoletoId === r.id ? '...' : 'Boleto ⬆️'}
                            <input type="file" hidden accept=".pdf" onChange={(e) => handleUploadBoleto(r.id, e)} />
                          </label>
                        )}
                        <button onClick={() => enviarWhatsApp(r)} style={btnZapStyle}>Zap</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>

          </div>

          <div style={columnStyle}>
            
            {/* ------------ NOVA SEÇÃO: ORDENS DE SERVIÇO ------------ */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🛠️ Ordens de Serviço</h3>
                <button onClick={() => abrirFormOs()} style={btnGreenStyle}>+ Nova O.S.</button>
              </div>
              {ordensServico.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhuma O.S. vinculada.</p>
              ) : (
                ordensServico.map(os => (
                  <div key={os.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#1a3353', display: 'block' }}>{formatarDateTime(os.data_hora_prevista) || 'Data a definir'}</span>
                        <span style={{ fontSize: '12px', color: '#555', display: 'block', margin: '4px 0' }}>{os.observacoes || 'Sem observações'}</span>
                      </div>
                      <select 
                        value={os.situacao} 
                        onChange={(e) => alterarSituacaoOs(os.id, e.target.value)}
                        style={selectStatusStyle}
                      >
                        <option value="agendada">📅 Agendada</option>
                        <option value="em_andamento">⚙️ Em Andamento</option>
                        <option value="concluida">✅ Concluída</option>
                        <option value="cancelada">🚫 Cancelada</option>
                      </select>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
                      <button onClick={() => abrirFormOs(os)} style={btnSmallStyle}>✏️ Editar</button>
                      <button onClick={() => excluirOs(os.id)} style={{...btnSmallStyle, color: '#dc3545'}}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>📝 Propostas Comerciais</h3>
                <button onClick={() => { setOrcamentoEditando(null); setAbrirNovaProposta(true); }} style={btnGreenStyle}>+ Nova Proposta</button>
              </div>
              {orcamentos.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhum orçamento gerado.</p>
              ) : (
                orcamentos.map(orc => (
                  <div key={orc.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#1a3353', display: 'block', marginBottom: '2px' }}>{orc.titulo || 'Proposta Assessoria e Laudos'}</span>
                        <span style={{ fontSize: '11px', color: '#666' }}>Emitido em: {renderizarDataSegura(orc.data_envio)}</span>
                      </div>
                      <select 
                        value={orc.situacao_orcamento} 
                        onChange={(e) => alterarSituacaoOrcamento(orc.id, e.target.value)}
                        style={selectStatusStyle}
                      >
                        <option value="Aguardando">⏳ Aguardando</option>
                        <option value="Aprovado">✅ Aprovado</option>
                        <option value="Recusado">❌ Recusado</option>
                        <option value="Cancelado">🚫 Cancelado</option>
                      </select>
                    </div>
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#28a745' }}>R$ {Number(orc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => abrirEdicaoProposta(orc)} style={btnViewStyle}>✏️ Editar / Gerar Word</button>
                        <button onClick={() => excluirOrcamento(orc.id)} style={{...btnSmallStyle, color: '#dc3545'}}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

           <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🕵️ Vistorias Técnicas</h3>
                <button onClick={() => setAbrirNovaVistoria(true)} style={btnGreenStyle}>+ Nova Vistoria</button>
              </div>
              {vistorias.map(v => (
                <div key={v.id} style={itemVistoriaStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ fontWeight: 'bold' }}>{renderizarDataSegura(v.data_agendamento)}</div>
                    <select 
                      value={v.situacao || 'agendada'} 
                      onChange={(e) => alterarSituacaoVistoria(v.id, e.target.value)}
                      style={selectStatusStyle}
                    >
                      <option value="agendada">⏳ Agendada</option>
                      <option value="realizada">✅ Realizada</option>
                      <option value="cancelada">🚫 Cancelada</option>
                    </select>
                  </div>
                  <button onClick={() => setVistoriaAbertaId(v.id)} style={btnOutlineStyle}>Checklist 📝</button>
                </div>
              ))}
            </section>

            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🖨️ Emissão de Laudos</h3>
                <button onClick={() => setAbrirGeradorLaudos(true)} style={{...btnGreenStyle, backgroundColor: '#007bff'}}>Gerar Laudos</button>
              </div>
              <p style={{ fontSize: '12px', color: '#666' }}>Selecione e gere atestados e laudos técnicos em lote para este condomínio.</p>
            </section>

            <section style={cardStyle}>
              <h3 style={cardTitleStyle}>📄 Histórico de Notas Fiscais</h3>
              {notasFiscais.map(nf => (
                <div key={nf.id} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>NF {nf.numero_nota || 'Pendente'}</strong></div>
                    {nf.file_path ? (
                      <button onClick={() => window.open(supabase.storage.from('notas_fiscais').getPublicUrl(nf.file_path).data.publicUrl, '_blank')} style={btnViewStyle}>Ver 📄</button>
                    ) : (
                      <label style={btnUploadNotaStyle}>
                        {subindoNotaId === nf.id ? '...' : 'Subir 📤'}
                        <input type="file" hidden accept=".pdf" onChange={(e) => handleUploadNota(nf.id, e)} />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      ) : (
        <GerenciamentoProjetos clienteId={cliente.id} clienteNome={cliente.nome} />
      )}

      {/* ================= MODAIS DE CADASTRO GERAL ================= */}
      {abrirNovaCobranca && (
        <FormularioCobranca 
          clienteId={cliente.id} 
          receitaEditando={receitaEditando}
          onCancelar={() => { setAbrirNovaCobranca(false); setReceitaEditando(null); }} 
          onSucesso={() => { setAbrirNovaCobranca(false); setReceitaEditando(null); loadClienteData(); }} 
        />
      )}
      {abrirNovaVistoria && (
        <NovaVistoriaModal clienteId={cliente.id} onClose={() => setAbrirNovaVistoria(false)} onSuccess={() => { setAbrirNovaVistoria(false); loadClienteData(); }} />
      )}
      {abrirNovaProposta && (
        <ModalNovaProposta 
          cliente={cliente} 
          orcamentoEditando={orcamentoEditando} 
          onClose={() => { 
            setAbrirNovaProposta(false); 
            setOrcamentoEditando(null); 
            loadClienteData(); 
          }} 
        />
      )}
      {abrirGeradorLaudos && (
        <ModalGeradorLaudos cliente={cliente} onClose={() => setAbrirGeradorLaudos(false)} />
      )}

      {/* ================= MODAL DE LEMBRETE ================= */}
      {abrirModalLembrete && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ marginTop: 0 }}>{lembreteForm.id ? 'Editar Lembrete' : 'Novo Lembrete'}</h3>
            <form onSubmit={salvarLembrete} style={columnStyle}>
              <div>
                <label style={miniLabelStyle}>Título do Lembrete</label>
                <input required style={inputEditableStyle} value={lembreteForm.titulo} onChange={e => setLembreteForm({...lembreteForm, titulo: e.target.value})} placeholder="Ex: Ligar para o Síndico" />
              </div>
              <div>
                <label style={miniLabelStyle}>Descrição (Opcional)</label>
                <textarea rows={3} style={inputEditableStyle} value={lembreteForm.descricao} onChange={e => setLembreteForm({...lembreteForm, descricao: e.target.value})} />
              </div>
              <div style={formGridStyle}>
                <div>
                  <label style={miniLabelStyle}>Data / Hora</label>
                  <input type="datetime-local" required style={inputEditableStyle} value={lembreteForm.data_lembrete} onChange={e => setLembreteForm({...lembreteForm, data_lembrete: e.target.value})} />
                </div>
                <div>
                  <label style={miniLabelStyle}>Prioridade</label>
                  <select style={inputEditableStyle} value={lembreteForm.prioridade} onChange={e => setLembreteForm({...lembreteForm, prioridade: e.target.value})}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setAbrirModalLembrete(false)} style={btnBackStyle}>Cancelar</button>
                <button type="submit" style={btnGreenStyle}>Salvar Lembrete</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE ORDEM DE SERVIÇO ================= */}
      {abrirModalOs && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ marginTop: 0 }}>{osForm.id ? 'Editar O.S.' : 'Nova Ordem de Serviço'}</h3>
            <form onSubmit={salvarOs} style={columnStyle}>
              <div>
                <label style={miniLabelStyle}>Descrição / Observações da O.S.</label>
                <textarea required rows={4} style={inputEditableStyle} value={osForm.observacoes} onChange={e => setOsForm({...osForm, observacoes: e.target.value})} placeholder="Descreva os detalhes da ordem de serviço..." />
              </div>
              <div style={formGridStyle}>
                <div>
                  <label style={miniLabelStyle}>Data / Hora Prevista</label>
                  <input type="datetime-local" required style={inputEditableStyle} value={osForm.data_hora_prevista} onChange={e => setOsForm({...osForm, data_hora_prevista: e.target.value})} />
                </div>
                <div>
                  <label style={miniLabelStyle}>Situação</label>
                  <select style={inputEditableStyle} value={osForm.situacao} onChange={e => setOsForm({...osForm, situacao: e.target.value})}>
                    <option value="agendada">Agendada</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setAbrirModalOs(false)} style={btnBackStyle}>Cancelar</button>
                <button type="submit" style={btnGreenStyle}>Salvar O.S.</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// --- ESTILOS CONSOLIDADOS ---
const containerStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', width: '100%', boxSizing: 'border-box' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', width: '100%' };
const mainGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '20px', width: '100%', alignItems: 'start' };
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '15px' };
const columnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const cardStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: '100%', boxSizing: 'border-box' };
const cardHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' };
const actionsRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' };
const avcbStatusStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold' };
const tabsContainerStyle: React.CSSProperties = { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd' };
const itemStyle: React.CSSProperties = { padding: '12px 0', borderBottom: '1px solid #eee' };
const cardTitleStyle: React.CSSProperties = { borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: 0, fontSize: '16px', color: '#1a3353' };

const btnBackStyle = { padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' };
const subTabStyle = { padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', color: '#666' };
const activeSubTabStyle = { ...subTabStyle, borderBottom: '3px solid #1a3353', fontWeight: 'bold', color: '#1a3353' };
const btnGreenStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as 'bold' };
const btnNFStyle = { padding: '6px 12px', fontSize: '11px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const btnZapStyle = { padding: '6px 12px', fontSize: '11px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const btnViewStyle = { padding: '6px 12px', fontSize: '12px', backgroundColor: '#eef2f7', border: '1px solid #999', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' as 'bold' };
const btnSmallStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' };
const btnUploadBoletoStyle = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const btnUploadNotaStyle = { padding: '6px 12px', backgroundColor: '#28a745', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const itemVistoriaStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', backgroundColor: '#fdfdfd', marginBottom: '8px' };
const btnOutlineStyle = { background: 'white', border: '1px solid #007bff', color: '#007bff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' as 'bold' };
const miniLabelStyle = { fontSize: '11px', color: '#555', textTransform: 'uppercase' as 'uppercase', display: 'block', marginBottom: '2px', fontWeight: 'bold' as 'bold' };
const inputStaticStyle = { width: '100%', padding: '5px 0', border: 'none', background: 'transparent', fontWeight: 'bold' as 'bold', color: '#333', fontSize: '14px' };
const inputEditableStyle = { width: '100%', padding: '8px', border: '1px solid #007bff', borderRadius: '6px', background: '#fff', fontSize: '14px', boxSizing: 'border-box' as 'border-box' };
const selectStatusStyle: React.CSSProperties = { padding: '4px', borderRadius: '4px', fontSize: '11px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', cursor: 'pointer' };

// Estilos dos Modais Internos
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' };