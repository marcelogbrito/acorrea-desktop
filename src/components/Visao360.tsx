import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FormularioCobranca } from './FormularioCobranca'
import { GerenciamentoProjetos } from './GerenciamentoProjetos'

interface Visao360Props {
  cliente: any;
  onBack: () => void;
  onSolicitarEmissao: (cliente: any, dados: { valor: string, descricao: string, receitaId?: string }) => void;
}

export function Visao360({ cliente, onBack, onSolicitarEmissao }: Visao360Props) {
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'projetos'>('geral')
  
  // Estados de Dados do Banco
  const [vistorias, setVistorias] = useState<any[]>([])
  const [orcamentos, setOrcamentos] = useState<any[]>([])
  const [ordensServico, setOrdensServico] = useState<any[]>([])
  const [avcbAtivo, setAvcbAtivo] = useState<any>(null)
  const [notasFiscais, setNotasFiscais] = useState<any[]>([])
  const [contasAReceber, setContasAReceber] = useState<any[]>([])
  
  // Estados de UI e Upload
  const [abrirNovaCobranca, setAbrirNovaCobranca] = useState(false)
  const [subindoNotaId, setSubindoNotaId] = useState<string | null>(null)
  const [subindoBoletoId, setSubindoBoletoId] = useState<string | null>(null)

  useEffect(() => {
    loadClienteData()
  }, [cliente.id])

  async function loadClienteData() {
    setLoading(true)
    try {
      // Busca simultânea de todas as frentes do cliente
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

  // --- LÓGICA FINANCEIRA ---

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

  if (loading) return <div style={{ padding: '20px' }}>Carregando dados...</div>

  return (
    <div style={{ padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* HEADER FIXO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <button onClick={onBack} style={btnBackStyle}>← Voltar para Lista</button>
        <h2 style={{ margin: 0 }}>🔍 Cliente: {cliente.nome}</h2>
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
          
          {/* COLUNA 1: DADOS E FINANCEIRO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section style={cardStyle}>
              <h3 style={cardTitleStyle}>📋 Dados do Condomínio</h3>
              <p><strong>CNPJ:</strong> {cliente.cnpj_cpf}</p>
              <p><strong>Endereço:</strong> {cliente.endereco}</p>
              <p><strong>Contato:</strong> {cliente.telefone} | {cliente.email}</p>
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

          {/* COLUNA 2: HISTÓRICO DE NOTAS E OPERACIONAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

            <section style={cardStyle}>
              <h3 style={cardTitleStyle}>🏗️ Status de Engenharia</h3>
              <p><strong>Vistorias Realizadas:</strong> {vistorias.length}</p>
              <p><strong>OS em Aberto:</strong> {ordensServico.filter(os => os.situacao !== 'concluida').length}</p>
              <p><strong>Orçamentos Enviados:</strong> {orcamentos.length}</p>
            </section>
          </div>

        </div>
      ) : (
        /* ABA DE PROJETOS AUTOMAÇÃO */
        <GerenciamentoProjetos clienteId={cliente.id} clienteNome={cliente.nome} />
      )}

      {/* MODAL COBRANÇA */}
      {abrirNovaCobranca && (
        <FormularioCobranca 
          clienteId={cliente.id} 
          onCancelar={() => setAbrirNovaCobranca(false)} 
          onSucesso={() => { setAbrirNovaCobranca(false); loadClienteData(); }} 
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