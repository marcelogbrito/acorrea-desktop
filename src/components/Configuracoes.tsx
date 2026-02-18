import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function Configuracoes({ onBack }: { onBack: () => void }) {
  const [usuarioGinfes, setUsuarioGinfes] = useState('')
  const [senhaGinfes, setSenhaGinfes] = useState('')
  
  // Novos campos para o Inbox (E-mail/WhatsApp)
  const [emailInbox, setEmailInbox] = useState('')
  const [senhaEmail, setSenhaEmail] = useState('')
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  async function loadConfigs() {
    // Busca credenciais do GINFES
    const { data: ginfes } = await supabase.from('credenciais_servicos').select('usuario').eq('servico', 'ginfes_santo_andre').single()
    if (ginfes) setUsuarioGinfes(ginfes.usuario)

    // Busca configuração do E-mail/Inbox
    const { data: inbox } = await supabase.from('credenciais_servicos').select('usuario').eq('servico', 'inbox_email').single()
    if (inbox) setEmailInbox(inbox.usuario)
  }

  const salvarNoCofre = async (servico: string, usuario: string, senha: string) => {
    if (!senha) return alert("Digite a senha para atualizar o cofre.")
    setLoading(true)
    try {
      // @ts-ignore
      const senhaCriptografada = await window.acorreaAPI.encryptPassword(senha)

      const { error } = await supabase
        .from('credenciais_servicos')
        .upsert({
          servico: servico,
          usuario: usuario,
          senha_hash: senhaCriptografada,
          updated_at: new Date().toISOString()
        }, { onConflict: 'servico' })

      if (error) throw error
      alert(`Credenciais de ${servico} atualizadas com sucesso!`)
      
      if (servico === 'ginfes_santo_andre') setSenhaGinfes('')
      if (servico === 'inbox_email') setSenhaEmail('')
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={onBack} style={btnBackStyle}>← Voltar ao Dashboard</button>
      <h2 style={{ color: '#1a3353', marginBottom: '30px' }}>⚙️ Configurações e Segurança</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* SEÇÃO 1: GINFES */}
        <section style={cardConfigStyle}>
          <h3>🔐 Notas Fiscais (GINFES)</h3>
          <p style={subTextStyle}>Acesso automatizado para emissão de notas.</p>
          
          <label style={labelStyle}>Usuário (CPF/CNPJ)</label>
          <input style={inputStyle} value={usuarioGinfes} onChange={e => setUsuarioGinfes(e.target.value)} />
          
          <label style={labelStyle}>Nova Senha</label>
          <input type="password" style={inputStyle} value={senhaGinfes} onChange={e => setSenhaGinfes(e.target.value)} />
          
          <button 
            onClick={() => salvarNoCofre('ginfes_santo_andre', usuarioGinfes, senhaGinfes)} 
            disabled={loading}
            style={btnPrimaryStyle}
          >
            {loading ? 'Processando...' : 'Atualizar GINFES'}
          </button>
        </section>

        {/* SEÇÃO 2: INBOX / E-MAIL */}
        <section style={cardConfigStyle}>
          <h3>📥 Conexão Inbox (E-mail)</h3>
          <p style={subTextStyle}>Configuração para triagem automática de mensagens.</p>
          
          <label style={labelStyle}>E-mail de Atendimento</label>
          <input style={inputStyle} value={emailInbox} onChange={e => setEmailInbox(e.target.value)} />
          
          <label style={labelStyle}>Senha do E-mail (App Password)</label>
          <input type="password" style={inputStyle} value={senhaEmail} onChange={e => setSenhaEmail(e.target.value)} />
          
          <button 
            onClick={() => salvarNoCofre('inbox_email', emailInbox, senhaEmail)} 
            disabled={loading}
            style={{ ...btnPrimaryStyle, backgroundColor: '#2c3e50' }}
          >
            {loading ? 'Processando...' : 'Atualizar Inbox'}
          </button>
        </section>

      </div>
    </div>
  )
}

// Estilos
const cardConfigStyle = { padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' as 'bold', marginTop: '15px' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as 'border-box' };
const subTextStyle = { fontSize: '12px', color: '#666', marginBottom: '15px' };
const btnPrimaryStyle = { width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' as 'bold' };
const btnBackStyle = { background: 'none', border: '1px solid #1a3353', color: '#1a3353', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' };