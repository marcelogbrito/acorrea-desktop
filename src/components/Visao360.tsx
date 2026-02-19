import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FormularioCobranca } from './FormularioCobranca'
import { GerenciamentoProjetos } from './GerenciamentoProjetos'
import { NovaVistoriaModal } from './NovaVistoriaModal' 
import { VistoriaDetalhes } from './VistoriaDetalhes' 

interface Visao360Props {
  cliente: any;
  onBack: () => void;
  onSolicitarEmissao: (cliente: any, dados: { valor: string, descricao: string, receitaId?: string }) => void;
}

export function Visao360({ cliente, onBack, onSolicitarEmissao }: Visao360Props) {
  // --- 1. TODOS OS HOOKS (Devem estar no topo) ---
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'projetos'>('geral')
  
  const [vistorias, setVistorias] = useState<any[]>([])
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [ordensServico,  setOrdensServico] = useState<any[]>([])
  const [avcbAtivo, setAvcbAtivo] = useState<any>(null)
  const [notasFiscais, setNotasFiscais] = useState<any[]>([])
  const [contasAReceber, setContasAReceber] = useState<any[]>([])
  
  const [abrirNovaCobranca, setAbrirNovaCobranca] = useState(false)
  const [abrirNovaVistoria, setAbrirNovaVistoria] = useState(false)
  const [vistoriaAbertaId, setVistoriaAbertaId] = useState<string | null>(null)
  
  const [subindoNotaId, setSubindoNotaId] = useState<string | null>(null)
  const [subindoBoletoId, setSubindoBoletoId] = useState<string | null>(null)

  // Estados para Edição de Dados do Cliente
  const [editandoDados, setEditandoDados] = useState(false)
  const [dadosCliente, setDadosCliente] = useState(cliente)

  console.log(orcamentos,ordensServico);


  useEffect(() => {
    loadClienteData()
    setDadosCliente(cliente) // Sincroniza se o cliente pai mudar
  }, [cliente.id])

  // --- 2. FUNÇÕES DE LÓGICA ---

  async function loadClienteData() {
    setLoading(true)
    try {
      const [resVist, resOrc, resOS, resAvcb, resNF, resRec] = await Promise.all([
        supabase.from('vistoria_previa_avcb').select('*, checklist_vistoria_avcb(*)').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
        supabase.from('orcamentos').select('*, servico:servico_id(nome_servico, tipo_servico:tipo_servico_id(nome))').eq('cliente_id', cliente.id).order('data_envio', { ascending: false }),
        supabase.from('ordens_de_servico').select('*, responsavel:responsavel_id(nome_razao_social)').eq('cliente_id', cliente.id).order('data_hora_prevista', { ascending: false }),
        supabase.from('avcbs_expedidas').select('*').eq('cliente_id', cliente.id).order('validade', { ascending: false }).limit(1),
        supabase.from('notas_fiscais').select('*, servicos(nome_servico)').eq('cliente_id', cliente.id).order('data_emissao', { ascending: false }),
        supabase.from('receitas').select('*').eq('cliente_id', cliente.id).order('data_vencimento', { ascending: true })
      ])

      setVistorias(resVist.data || [])
      setOrcamentos(resOrc.data || [])
      setOrdensServico(resOS.data || [])
      setAvcbAtivo(resAvcb.data?.[0] || null)
      setNotasFiscais(resNF.data || [])
      setContasAReceber(resRec.data || [])
    } finally {
      setLoading(false)
    }
  }

  const salvarDadosGerais = async () => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: dadosCliente.nome,
          cnpj_cpf: dadosCliente.cnpj_cpf,
          endereco: dadosCliente.endereco,
          telefone: dadosCliente.telefone,
          email: dadosCliente.email
        })
        .eq('id', cliente.id)

      if (error) throw error
      alert("✅ Dados do cliente atualizados!")
      setEditandoDados(false)
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message)
    }
  }

  const dispararNFParaReceita = (receita: any) => {
    const confirmar = window.confirm(`Deseja disparar a emissão da NF para a parcela de R$ ${receita.valor_receber}?`);
    if (confirmar) {
      onSolicitarEmissao(cliente, {
        valor: receita.valor_receber.toString(),
        descricao: receita.discriminacao_servicos,
        receitaId: receita.id
      });
    }
  }

  const handleUploadNota = async (nfId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSubindoNotaId(nfId)
    try {
      const fileName = `${cliente.id}/nf_${nfId}_${Date.now()}.pdf`
      await supabase.storage.from('notas_fiscais').upload(fileName, file)
      await supabase.from('notas_fiscais').update({ file_path: fileName, situacao: 'Emitida' }).eq('id', nfId)
      alert('Nota Fiscal anexada!')
      loadClienteData()
    } catch (err: any) { alert(err.message) } finally { setSubindoNotaId(null) }
  }

  const handleUploadBoleto = async (receitaId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSubindoBoletoId(receitaId)
    try {
      const fileName = `${cliente.id}/boleto_${receitaId}_${Date.now()}.pdf`
      await supabase.storage.from('boletos').upload(fileName, file)
      await supabase.from('receitas').update({ path_documento_cobranca: fileName }).eq('id', receitaId)
      alert('Boleto anexado!')
      loadClienteData()
    } catch (err: any) { alert(err.message) } finally { setSubindoBoletoId(null) }
  }

  const abrirPacoteCobranca = (receita: any) => {
    const nf = notasFiscais.find(n => n.receita_id === receita.id)
    if (receita.path_documento_cobranca) {
      const urlBoleto = supabase.storage.from('boletos').getPublicUrl(receita.path_documento_cobranca).data.publicUrl
      window.open(urlBoleto, '_blank')
    }
    if (nf?.file_path) {
      const urlNF = supabase.storage.from('notas_fiscais').getPublicUrl(nf.file_path).data.publicUrl
      setTimeout(() => window.open(urlNF, '_blank'), 600)
    }
  }

  const enviarWhatsApp = (receita: any) => {
    const nf = notasFiscais.find(n => n.receita_id === receita.id)
    const urlBoleto = receita.path_documento_cobranca ? supabase.storage.from('boletos').getPublicUrl(receita.path_documento_cobranca).data.publicUrl : null
    const urlNF = nf?.file_path ? supabase.storage.from('notas_fiscais').getPublicUrl(nf.file_path).data.publicUrl : null
    
    const msg = encodeURIComponent(`Olá! Segue a cobrança do condomínio:\n*Serviço:* ${receita.discriminacao_servicos}\n*Valor:* R$ ${Number(receita.valor_receber).toLocaleString('pt-BR')}\n*Vencimento:* ${new Date(receita.data_vencimento).toLocaleDateString()}${urlBoleto ? `\n*Boleto:* ${urlBoleto}` : ''}${urlNF ? `\n*NF:* ${urlNF}` : ''}`)
    window.open(`https://web.whatsapp.com/send?phone=55${cliente.telefone?.replace(/\D/g, '')}&text=${msg}`, '_blank')
  }

  // --- 3. RENDERIZAÇÃO CONDICIONAL ---

  if (loading) return <div style={{ padding: '20px' }}>Carregando dados...</div>

  if (vistoriaAbertaId) {
    return (
      <VistoriaDetalhes 
        vistoriaId={vistoriaAbertaId} 
        onBack={() => { setVistoriaAbertaId(null); loadClienteData(); }} 
      />
    )
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* HEADER FIXO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <button onClick={onBack} style={btnBackStyle}>← Voltar para Lista</button>
        <h2 style={{ margin: 0 }}>🔍 Cliente: {dadosCliente.nome}</h2>
        <div style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: avcbAtivo ? '#d4edda' : '#f8d7da', color: avcbAtivo ? '#155724' : '#721c24', fontWeight: 'bold' }}>
          {avcbAtivo ? `AVCB Vence: ${new Date(avcbAtivo.validade).toLocaleDateString()}` : 'Sem AVCB Ativo'}
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO INTERNA */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        <button onClick={() => setAbaAtiva('geral')} style={abaAtiva === 'geral' ? activeSubTabStyle : subTabStyle}>📋 Administrativo / Financeiro</button>
        <button onClick={() => setAbaAtiva('projetos')} style={abaAtiva === 'projetos' ? activeSubTabStyle : subTabStyle}>📐 Projetos AutoCAD (PyCAD)</button>
      </div>

      {abaAtiva === 'geral' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* COLUNA 1: DADOS EDITÁVEIS E FINANCEIRO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <h3 style={cardTitleStyle}>📋 Dados do Condomínio</h3>
                <button 
                  onClick={() => editandoDados ? salvarDadosGerais() : setEditandoDados(true)}
                  style={editandoDados ? btnGreenStyle : btnViewStyle}
                >
                  {editandoDados ? 'Salvar Alterações' : 'Editar Dados'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={miniLabelStyle}>Nome do Condomínio</label>
                  <input 
                    disabled={!editandoDados} 
                    style={editandoDados ? inputEditableStyle : inputStaticStyle} 
                    value={dadosCliente.nome} 
                    onChange={e => setDadosCliente({...dadosCliente, nome: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={miniLabelStyle}>CNPJ/CPF</label>
                  <input 
                    disabled={!editandoDados} 
                    style={editandoDados ? inputEditableStyle : inputStaticStyle} 
                    value={dadosCliente.cnpj_cpf} 
                    onChange={e => setDadosCliente({...dadosCliente, cnpj_cpf: e.target.value})} 
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={miniLabelStyle}>Endereço</label>
                  <input 
                    disabled={!editandoDados} 
                    style={editandoDados ? inputEditableStyle : inputStaticStyle} 
                    value={dadosCliente.endereco} 
                    onChange={e => setDadosCliente({...dadosCliente, endereco: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={miniLabelStyle}>Telefone</label>
                  <input 
                    disabled={!editandoDados} 
                    style={editandoDados ? inputEditableStyle : inputStaticStyle} 
                    value={dadosCliente.telefone} 
                    onChange={e => setDadosCliente({...dadosCliente, telefone: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={miniLabelStyle}>E-mail</label>
                  <input 
                    disabled={!editandoDados} 
                    style={editandoDados ? inputEditableStyle : inputStaticStyle} 
                    value={dadosCliente.email} 
                    onChange={e => setDadosCliente({...dadosCliente, email: e.target.value})} 
                  />
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>💳 Contas a Receber</h3>
                <button onClick={() => setAbrirNovaCobranca(true)} style={btnGreenStyle}>+ Cobrança</button>
              </div>
              {contasAReceber.map(r => {
                const nf = notasFiscais.find(n => n.receita_id === r.id)
                const temBoleto = !!r.path_documento_cobranca
                const temNota = !!nf?.file_path
                return (
                  <div key={r.id} style={itemStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold', color: r.situacao === 'Pago' ? 'green' : '#d9534f' }}>{r.discriminacao_servicos}</span>
                      <span style={{ fontSize: '11px' }}>{new Date(r.data_vencimento).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <strong>R$ {Number(r.valor_receber).toLocaleString('pt-BR')}</strong>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {temBoleto && temNota && <button onClick={() => abrirPacoteCobranca(r)} style={btnPackageStyle}>📦 Kit</button>}
                        {!temNota && <button onClick={() => dispararNFParaReceita(r)} style={btnNFStyle}>📑 Nota</button>}
                        {temBoleto ? (
                           <button onClick={() => window.open(supabase.storage.from('boletos').getPublicUrl(r.path_documento_cobranca).data.publicUrl, '_blank')} style={btnViewStyle}>Boleto</button>
                        ) : (
                          <label style={btnUploadBoletoStyle}>
                            {subindoBoletoId === r.id ? '...' : 'Boleto ⬆️'}
                            <input type="file" hidden accept=".pdf" onChange={(e) => handleUploadBoleto(r.id, e)} />
                          </label>
                        )}
                        <button onClick={() => enviarWhatsApp(r)} style={btnZapStyle}>Zap 📱</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          </div>

          {/* COLUNA 2: VISTORIAS E HISTÓRICO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <section style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={cardTitleStyle}>🕵️ Vistorias Técnicas</h3>
                <button onClick={() => setAbrirNovaVistoria(true)} style={btnGreenStyle}>+ Nova Vistoria</button>
              </div>

              {vistorias.length === 0 ? (
                <p style={{ color: '#999', fontSize: '13px', textAlign: 'center' }}>Nenhuma vistoria registrada.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {vistorias.map(v => (
                    <div key={v.id} style={itemVistoriaStyle}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{new Date(v.data_agendamento).toLocaleDateString()}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{v.nome_edificacao}</div>
                        <div style={{ fontSize: '11px', color: v.situacao === 'concluida' ? 'green' : 'orange' }}>
                          Status: {v.situacao ? v.situacao.toUpperCase() : 'AGENDADA'}
                        </div>
                      </div>
                      <button onClick={() => setVistoriaAbertaId(v.id)} style={btnOutlineStyle}>Abrir Checklist 📝</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={cardStyle}>
              <h3 style={cardTitleStyle}>📄 Histórico de Notas Fiscais</h3>
              {notasFiscais.map(nf => (
                <div key={nf.id} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>NF {nf.numero_nota || 'Pendente'}</strong>
                      <div style={{ fontSize: '11px', color: '#666' }}>R$ {Number(nf.valor).toLocaleString('pt-BR')}</div>
                    </div>
                    {nf.file_path ? (
                      <button onClick={() => {
                        const { data } = supabase.storage.from('notas_fiscais').getPublicUrl(nf.file_path);
                        window.open(data.publicUrl, '_blank');
                      }} style={btnViewStyle}>Ver 📄</button>
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

      {/* MODAIS */}
      {abrirNovaCobranca && (
        <FormularioCobranca 
          clienteId={cliente.id} 
          onCancelar={() => setAbrirNovaCobranca(false)} 
          onSucesso={() => { setAbrirNovaCobranca(false); loadClienteData(); }} 
        />
      )}

      {abrirNovaVistoria && (
        <NovaVistoriaModal 
           clienteId={cliente.id}
           onClose={() => setAbrirNovaVistoria(false)}
           onSuccess={() => { setAbrirNovaVistoria(false); loadClienteData(); }}
        />
      )}
    </div>
  )
}

// ESTILOS CONSOLIDADOS
const cardStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' };
const cardTitleStyle = { borderBottom: '1px solid #ddd', paddingBottom: '10px', marginTop: 0, fontSize: '16px', color: '#1a3353' };
const itemStyle = { padding: '10px 0', borderBottom: '1px solid #eee' };
const btnBackStyle = { padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' };
const subTabStyle = { padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', color: '#666' };
const activeSubTabStyle = { ...subTabStyle, borderBottom: '3px solid #1a3353', fontWeight: 'bold', color: '#1a3353' };
const btnGreenStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px' };
const btnNFStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const btnViewStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#eef2f7', border: '1px solid #999', borderRadius: '3px', cursor: 'pointer' };
const btnPackageStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const btnZapStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' };
const btnUploadBoletoStyle = { padding: '4px 8px', backgroundColor: '#007bff', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const btnUploadNotaStyle = { padding: '4px 8px', backgroundColor: '#28a745', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' };
const itemVistoriaStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', border: '1px solid #f0f0f0', borderRadius: '6px', backgroundColor: '#fdfdfd' };
const btnOutlineStyle = { background: 'white', border: '1px solid #007bff', color: '#007bff', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' as 'bold' };

// ESTILOS DE EDIÇÃO
const miniLabelStyle = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as 'uppercase', display: 'block', marginBottom: '2px' };
const inputStaticStyle = { width: '100%', padding: '5px 0', border: 'none', background: 'transparent', fontWeight: 'bold' as 'bold', color: '#333', fontSize: '14px' };
const inputEditableStyle = { width: '100%', padding: '8px', border: '1px solid #007bff', borderRadius: '4px', background: '#fff', fontSize: '14px', boxSizing: 'border-box' as 'border-box' };