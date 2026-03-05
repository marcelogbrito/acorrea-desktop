//src\components\Visao360.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FormularioCobranca } from './FormularioCobranca'
import { GerenciamentoProjetos } from './GerenciamentoProjetos'
import { NovaVistoriaModal } from './NovaVistoriaModal' 
import { VistoriaDetalhes } from './VistoriaDetalhes' 
import { ModalNovaProposta } from './ModalNovaProposta' // <-- IMPORTAÇÃO CORRIGIDA
import { ModalGeradorLaudos } from './ModalGeradorLaudos';

interface Visao360Props {
  cliente: any;
  onBack: () => void;
  onSolicitarEmissao: (cliente: any, dados: { valor: string, descricao: string, receitaId?: string }) => void;
}

export function Visao360({ cliente, onBack, onSolicitarEmissao }: Visao360Props) {
  // --- ESTADOS ---
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'projetos'>('geral')
  const [vistorias, setVistorias] = useState<any[]>([])
  const [avcbAtivo, setAvcbAtivo] = useState<any>(null)
  const [notasFiscais, setNotasFiscais] = useState<any[]>([])
  const [contasAReceber, setContasAReceber] = useState<any[]>([])
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  
  const [abrirNovaCobranca, setAbrirNovaCobranca] = useState(false)
  const [abrirNovaVistoria, setAbrirNovaVistoria] = useState(false)
  const [abrirNovaProposta, setAbrirNovaProposta] = useState(false) 
  const [vistoriaAbertaId, setVistoriaAbertaId] = useState<string | null>(null)
  
  const [subindoNotaId, setSubindoNotaId] = useState<string | null>(null)
  const [subindoBoletoId, setSubindoBoletoId] = useState<string | null>(null)
  const [editandoDados, setEditandoDados] = useState(false)
  const [dadosCliente, setDadosCliente] = useState(cliente)
  const [abrirGeradorLaudos, setAbrirGeradorLaudos] = useState(false);

  useEffect(() => {
    loadClienteData()
    setDadosCliente(cliente)
  }, [cliente.id])

  // --- LÓGICA ---
  async function loadClienteData() {
    setLoading(true)
    try {
      const [resVist, resAvcb, resNF, resRec, resOrc] = await Promise.all([
        supabase.from('vistoria_previa_avcb').select('*, checklist_vistoria_avcb(*)').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
        supabase.from('avcbs_expedidas').select('*').eq('cliente_id', cliente.id).order('validade', { ascending: false }).limit(1),
        supabase.from('notas_fiscais').select('*, servicos(nome_servico)').eq('cliente_id', cliente.id).order('data_emissao', { ascending: false }),
        supabase.from('receitas').select('*').eq('cliente_id', cliente.id).order('data_vencimento', { ascending: true }),
        supabase.from('orcamentos').select('*').eq('cliente_id', cliente.id).order('created_at', { ascending: false })
      ])
      setVistorias(resVist.data || [])
      setAvcbAtivo(resAvcb.data?.[0] || null)
      setNotasFiscais(resNF.data || [])
      setContasAReceber(resRec.data || [])
      setOrcamentos(resOrc.data || [])
    } finally {
      setLoading(false)
    }
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
          email: dadosCliente.email
        }).eq('id', cliente.id)
      if (error) throw error
      alert("✅ Dados do cliente atualizados!")
      setEditandoDados(false)
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
    const msg = encodeURIComponent(`Olá! Segue a cobrança:\n*Serviço:* ${receita.discriminacao_servicos}\n*Valor:* R$ ${Number(receita.valor_receber).toLocaleString('pt-BR')}\n*Vencimento:* ${new Date(receita.data_vencimento).toLocaleDateString()}${urlBoleto ? `\n*Boleto:* ${urlBoleto}` : ''}${urlNF ? `\n*NF:* ${urlNF}` : ''}`)
    window.open(`https://web.whatsapp.com/send?phone=55${cliente.telefone?.replace(/\D/g, '')}&text=${msg}`, '_blank')
  }

  const alterarSituacaoOrcamento = async (id: string, novaSituacao: string) => {
    const { error } = await supabase
      .from('orcamentos')
      .update({ situacao_orcamento: novaSituacao })
      .eq('id', id);
    
    if (error) {
      alert("Erro ao atualizar situação: " + error.message);
      return;
    }

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

  if (loading) return <div style={{ padding: '20px' }}>Carregando dados...</div>

  if (vistoriaAbertaId) {
    return <VistoriaDetalhes vistoriaId={vistoriaAbertaId} onBack={() => { setVistoriaAbertaId(null); loadClienteData(); }} />
  }

  return (
    <div style={containerStyle}>
      
      {/* HEADER */}
      <div style={headerStyle}>
        <button onClick={onBack} style={btnBackStyle}>← Voltar para Lista</button>
        <h2 style={{ margin: 0 }}>🔍 Cliente: {dadosCliente.nome}</h2>
        <div style={{ ...avcbStatusStyle, backgroundColor: avcbAtivo ? '#d4edda' : '#f8d7da', color: avcbAtivo ? '#155724' : '#721c24' }}>
          {avcbAtivo ? `AVCB Vence: ${new Date(avcbAtivo.validade).toLocaleDateString()}` : 'Sem AVCB Ativo'}
        </div>
      </div>

      <div style={tabsContainerStyle}>
        <button onClick={() => setAbaAtiva('geral')} style={abaAtiva === 'geral' ? activeSubTabStyle : subTabStyle}>📋 Administrativo / Financeiro</button>
        <button onClick={() => setAbaAtiva('projetos')} style={abaAtiva === 'projetos' ? activeSubTabStyle : subTabStyle}>📐 Projetos AutoCAD (PyCAD)</button>
      </div>

      {abaAtiva === 'geral' ? (
        <div style={mainGridStyle}>
          
          {/* COLUNA ESQUERDA */}
          <div style={columnStyle}>
            {/* DADOS DO CLIENTE */}
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

            {/* FINANCEIRO */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>💳 Contas a Receber</h3>
                <button onClick={() => setAbrirNovaCobranca(true)} style={btnGreenStyle}>+ Cobrança</button>
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
                      <span style={{ fontSize: '11px' }}>{new Date(r.data_vencimento).toLocaleDateString()}</span>
                    </div>
                    <div style={actionsRowStyle}>
                      <strong>R$ {Number(r.valor_receber).toLocaleString('pt-BR')}</strong>
                      <div style={{ display: 'flex', gap: '8px' }}>
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

          {/* COLUNA DIREITA */}
          <div style={columnStyle}>
            
            {/* SEÇÃO ORÇAMENTOS (NOVA) */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>📝 Propostas Comerciais</h3>
                <button onClick={() => setAbrirNovaProposta(true)} style={btnGreenStyle}>+ Nova Proposta</button>
              </div>
              {orcamentos.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhum orçamento gerado.</p>
              ) : (
                orcamentos.map(orc => (
                  <div key={orc.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {/* TÍTULO DINÂMICO AQUI */}
                        <span style={{ fontWeight: 'bold', color: '#1a3353' }}>{orc.titulo || 'Proposta Assessoria e Laudos'}</span>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          Emitido em: {new Date(orc.data_envio).toLocaleDateString()}
                        </div>
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
                    <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>R$ {Number(orc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* SEÇÃO VISTORIAS */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🕵️ Vistorias Técnicas</h3>
                <button onClick={() => setAbrirNovaVistoria(true)} style={btnGreenStyle}>+ Nova Vistoria</button>
              </div>
              {vistorias.map(v => (
                <div key={v.id} style={itemVistoriaStyle}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{new Date(v.data_agendamento).toLocaleDateString()}</div>
                    <div style={{ fontSize: '12px', color: v.situacao === 'concluida' ? 'green' : 'orange' }}>{v.situacao?.toUpperCase() || 'AGENDADA'}</div>
                  </div>
                  <button onClick={() => setVistoriaAbertaId(v.id)} style={btnOutlineStyle}>Checklist 📝</button>
                </div>
              ))}
            </section>

            {/* SEÇÃO EMISSAO DE LAUDOS */}
            <section style={cardStyle}>
              <div style={cardHeaderStyle}>
                <h3 style={{ margin: 0 }}>🖨️ Emissão de Laudos</h3>
                <button onClick={() => setAbrirGeradorLaudos(true)} style={{...btnGreenStyle, backgroundColor: '#007bff'}}>Gerar Laudos</button>
              </div>
              <p style={{ fontSize: '12px', color: '#666' }}>Selecione e gere atestados e laudos técnicos em lote para este condomínio.</p>
            </section>

            {/* SEÇÃO NOTAS FISCAIS */}
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

      {/* MODAIS: AQUI A CHAMADA DO MODAL DE PROPOSTA FOI CORRIGIDA */}
      {abrirNovaCobranca && (
        <FormularioCobranca clienteId={cliente.id} onCancelar={() => setAbrirNovaCobranca(false)} onSucesso={() => { setAbrirNovaCobranca(false); loadClienteData(); }} />
      )}
      {abrirNovaVistoria && (
        <NovaVistoriaModal clienteId={cliente.id} onClose={() => setAbrirNovaVistoria(false)} onSuccess={() => { setAbrirNovaVistoria(false); loadClienteData(); }} />
      )}
      {abrirNovaProposta && (
        <ModalNovaProposta cliente={cliente} onClose={() => { setAbrirNovaProposta(false); loadClienteData(); }} />
      )}
      {abrirGeradorLaudos && (
        <ModalGeradorLaudos cliente={cliente} onClose={() => setAbrirGeradorLaudos(false)} />
      )}
    </div>
  )
}

// --- ESTILOS CONSOLIDADOS ---
const containerStyle: React.CSSProperties = { padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', width: '100%', boxSizing: 'border-box' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', width: '100%' };
const mainGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', width: '100%', alignItems: 'start' };
const columnStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const cardStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: '100%', boxSizing: 'border-box' };
const cardHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' };
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
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
const btnViewStyle = { padding: '6px 12px', fontSize: '12px', backgroundColor: '#eef2f7', border: '1px solid #999', borderRadius: '3px', cursor: 'pointer' };
const btnSmallStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' };
const btnUploadBoletoStyle = { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const btnUploadNotaStyle = { padding: '6px 12px', backgroundColor: '#28a745', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const itemVistoriaStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f0f0f0', borderRadius: '8px', backgroundColor: '#fdfdfd', marginBottom: '8px' };
const btnOutlineStyle = { background: 'white', border: '1px solid #007bff', color: '#007bff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' as 'bold' };
const miniLabelStyle = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as 'uppercase', display: 'block', marginBottom: '2px' };
const inputStaticStyle = { width: '100%', padding: '5px 0', border: 'none', background: 'transparent', fontWeight: 'bold' as 'bold', color: '#333', fontSize: '14px' };
const inputEditableStyle = { width: '100%', padding: '8px', border: '1px solid #007bff', borderRadius: '6px', background: '#fff', fontSize: '14px', boxSizing: 'border-box' as 'border-box' };
const selectStatusStyle: React.CSSProperties = {
  padding: '4px',
  borderRadius: '4px',
  fontSize: '11px',
  border: '1px solid #ccc',
  backgroundColor: '#f8f9fa',
  cursor: 'pointer'
};