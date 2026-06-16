// src/components/GerenciadorParceiros.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface GerenciadorParceirosProps {
  onSelecionarCliente: (cliente: any) => void;
}

export function GerenciadorParceiros({ onSelecionarCliente }: GerenciadorParceirosProps) {
  const [parceiros, setParceiros] = useState<any[]>([])
  const [parceiroSelecionado, setParceiroSelecionado] = useState<any | null>(null)
  const [clientesVinculados, setClientesVinculados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Estado do Formulário CRUD
  const [form, setForm] = useState({ id: '', nome: '', cnpj_cpf: '', telefone: '', email: '', endereco: '' })
  const [modoEdicao, setModoEdicao] = useState(false)

  useEffect(() => {
    carregarParceiros()
  }, [])

  useEffect(() => {
    if (parceiroSelecionado) {
      carregarClientesVinculados(parceiroSelecionado.id)
      setForm({
        id: parceiroSelecionado.id,
        nome: parceiroSelecionado.nome || '',
        cnpj_cpf: parceiroSelecionado.cnpj_cpf || '',
        telefone: parceiroSelecionado.telefone || '',
        email: parceiroSelecionado.email || '',
        endereco: parceiroSelecionado.endereco || ''
      })
    } else {
      limparFormulario()
    }
  }, [parceiroSelecionado])

  async function carregarParceiros() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('parceiro', true)
      .order('nome')
    if (!error && data) setParceiros(data)
    setLoading(false)
  }

  async function carregarClientesVinculados(parceiroId: string) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('parceiro_id', parceiroId)
      .order('nome')
    if (!error && data) setClientesVinculados(data)
  }

  const limparFormulario = () => {
    setForm({ id: '', nome: '', cnpj_cpf: '', telefone: '', email: '', endereco: '' })
    setModoEdicao(false)
    setClientesVinculados([])
  }

  const handleSalvarParceiro = async () => {
    if (!form.nome) return alert("O nome do parceiro é obrigatório.")
    setSaving(true)

    const dadosParceiro = {
      nome: form.nome.toUpperCase(),
      cnpj_cpf: form.cnpj_cpf.replace(/\D/g, ''),
      telefone: form.telefone,
      email: form.email,
      endereco: form.endereco,
      parceiro: true // Garante a flag ativa
    }

    try {
      if (form.id) {
        // UPDATE
        const { error } = await supabase.from('clientes').update(dadosParceiro).eq('id', form.id)
        if (error) throw error
        alert("✅ Parceiro atualizado com sucesso!")
      } else {
        // CREATE
        const { error } = await supabase.from('clientes').insert([dadosParceiro])
        if (error) throw error
        alert("✅ Novo parceiro cadastrado com sucesso!")
      }
      limparFormulario()
      setParceiroSelecionado(null)
      carregarParceiros()
    } catch (err: any) {
      alert("Erro ao salvar parceiro: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExcluirParceiro = async (id: string) => {
    if (!window.confirm("🗑️ Tem certeza que deseja remover este parceiro do sistema?\nOs clientes vinculados passarão a ser Atendimento Direto.")) return
    
    setSaving(true)
    try {
      // 1. Desvincula os clientes primeiro (muda parceiro_id para null) para evitar quebra de integridade
      await supabase.from('clientes').update({ parceiro_id: null }).eq('parceiro_id', id)
      
      // 2. Deleta o registro do parceiro
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error

      alert("✅ Parceiro removido!")
      limparFormulario()
      setParceiroSelecionado(null)
      carregarParceiros()
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const navegarParaVisao360 = async (clienteMapeado: any) => {
    // Busca os dados completos do cliente para garantir que a Visão 360 funcione perfeitamente
    const { data } = await supabase.from('clientes').select('*').eq('id', clienteMapeado.id).single()
    if (data) onSelecionarCliente(data)
  }

  if (loading) return <div style={{ padding: '20px' }}>Sincronizando Parceiros...</div>

  return (
    <div style={gridMaster}>
      
      {/* PAINEL ESQUERDO: LISTA DE PARCEIROS */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <h3 style={{ margin: 0, color: '#1a3353' }}>🤝 Parceiros de Consultoria</h3>
          <button onClick={() => { setParceiroSelecionado(null); setModoEdicao(true); }} style={btnGreenStyle}>+ Novo Parceiro</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          {parceiros.map(p => (
            <div 
              key={p.id} 
              onClick={() => { setParceiroSelecionado(p); setModoEdicao(false); }}
              style={{
                ...itemParceiro,
                backgroundColor: parceiroSelecionado?.id === p.id ? '#e7f3ff' : '#fff',
                border: parceiroSelecionado?.id === p.id ? '1px solid #007bff' : '1px solid #eee'
              }}
            >
              <div>
                <strong>{p.nome}</strong>
                <div style={{ fontSize: '11px', color: '#666' }}>{p.cnpj_cpf || 'Sem CNPJ'}</div>
              </div>
              <span style={badgeStyle}>{parceiroSelecionado?.id === p.id ? 'Selecionado' : 'Ver'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PAINEL DIREITO: FORMULÁRIO CRUD E CLIENTES VINCULADOS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {(parceiroSelecionado || modoEdicao) && (
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              {form.id ? `📝 Cadastro: ${form.nome}` : '➕ Cadastrar Novo Parceiro'}
            </h3>
            
            <div style={formGrid}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nome / Razão Social</label>
                <input style={inputStyle} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>CPF/CNPJ</label>
                <input style={inputStyle} value={form.cnpj_cpf} onChange={e => setForm({ ...form, cnpj_cpf: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input style={inputStyle} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>E-mail</label>
                <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Endereço Comercial</label>
                <input style={inputStyle} value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              {form.id && (
                <button disabled={saving} onClick={() => handleExcluirParceiro(form.id)} style={{ ...btnStyle, backgroundColor: '#dc3545' }}>Excluir</button>
              )}
              <button disabled={saving} onClick={handleSalvarParceiro} style={{ ...btnStyle, backgroundColor: '#28a745' }}>
                {saving ? '⏳...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

        {/* LISTAGEM DOS CONDOMÍNIOS VINCULADOS AO PARCEIRO */}
        {parceiroSelecionado && !modoEdicao && (
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>🏢 Condomínios Vinculados ({clientesVinculados.length})</h3>
            {clientesVinculados.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '15px' }}>
                Nenhum condomínio associado a este parceiro no momento.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {clientesVinculados.map(cli => (
                  <div key={cli.id} style={rowClienteStyle}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#333' }}>{cli.nome}</strong>
                      <div style={{ fontSize: '11px', color: '#666' }}>CNPJ: {cli.cnpj_cpf || 'Não Informado'}</div>
                    </div>
                    <button onClick={() => navegarParaVisao360(cli)} style={btnLink360}>
                      Visão 360° 🔍
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// Estilos de Layout Adaptáveis e Responsivos
const gridMaster: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '20px', alignItems: 'start' }
const cardStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }
const cardHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px', marginBottom: '10px' }
const cardTitleStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0', paddingBottom: '12px', marginTop: 0, color: '#1a3353', fontSize: '16px' }
const itemParceiro: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }
const formGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }
const labelStyle = { fontSize: '11px', color: '#444', fontWeight: 'bold' as 'bold', textTransform: 'uppercase' as 'uppercase', marginBottom: '4px', display: 'block' }
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as 'border-box' }
const rowClienteStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', border: '1px solid #eee', borderRadius: '6px', backgroundColor: '#fafafa' }

const btnGreenStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as 'bold' }
const badgeStyle = { fontSize: '11px', backgroundColor: '#eef2f7', color: '#007bff', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' as 'bold' }
const btnStyle = { padding: '10px 20px', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as 'bold', fontSize: '13px' }
const btnLink360 = { backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as 'bold' }