import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react' // Certifique-se de ter instalado: npm install qrcode.react

export function Configuracoes({ onBack }: { onBack: () => void }) {
  const [usuarioGinfes, setUsuarioGinfes] = useState('')
  const [senhaGinfes, setSenhaGinfes] = useState('')
  const [emailInbox, setEmailInbox] = useState('')
  const [senhaEmail, setSenhaEmail] = useState('')
  const [loading, setLoading] = useState(false)

  // Estados para o WhatsApp
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [statusWA, setStatusWA] = useState<'desconectado' | 'conectando' | 'pronto'>('desconectado')

  useEffect(() => {
    loadConfigs()

    // Escuta o QR Code vindo do Main Process
    // @ts-ignore
    if (window.acorreaAPI?.onWhatsAppQR) {
      // @ts-ignore
      const unsubQR = window.acorreaAPI.onWhatsAppQR((qr: string) => {
        setQrCode(qr)
        setStatusWA('conectando')
      })

      // Escuta o log de sucesso para mudar o status
      // @ts-ignore
      const unsubLog = window.acorreaAPI.onInboxLog((msg: string) => {
        if (msg.includes('✅')) setStatusWA('pronto')
      })

      return () => {
        unsubQR()
        unsubLog()
      }
    }
  }, [])

  async function loadConfigs() {
    const { data: ginfes } = await supabase.from('credenciais_servicos').select('usuario').eq('servico', 'ginfes_santo_andre').single()
    if (ginfes) setUsuarioGinfes(ginfes.usuario)

    const { data: inbox } = await supabase.from('credenciais_servicos').select('usuario').eq('servico', 'inbox_email').single()
    if (inbox) setEmailInbox(inbox.usuario)
  }

  const salvarNoCofre = async (servico: string, usuario: string, senha: string) => {
    if (!senha) return alert("Digite a senha para atualizar o cofre.")
    setLoading(true)
    try {
      // @ts-ignore
      const senhaCriptografada = await window.acorreaAPI.encryptPassword(senha)
      const { error } = await supabase.from('credenciais_servicos').upsert({
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
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
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
          <button onClick={() => salvarNoCofre('ginfes_santo_andre', usuarioGinfes, senhaGinfes)} disabled={loading} style={btnPrimaryStyle}>
            {loading ? 'Processando...' : 'Atualizar GINFES'}
          </button>
        </section>

        {/* SEÇÃO 2: INBOX / E-MAIL */}
        <section style={cardConfigStyle}>
          <h3>📥 Conexão Inbox (E-mail)</h3>
          <p style={subTextStyle}>Configuração para triagem de mensagens.</p>
          <label style={labelStyle}>E-mail de Atendimento</label>
          <input style={inputStyle} value={emailInbox} onChange={e => setEmailInbox(e.target.value)} />
          <label style={labelStyle}>Senha do E-mail (App Password)</label>
          <input type="password" style={inputStyle} value={senhaEmail} onChange={e => setSenhaEmail(e.target.value)} />
          <button onClick={() => salvarNoCofre('inbox_email', emailInbox, senhaEmail)} disabled={loading} style={{ ...btnPrimaryStyle, backgroundColor: '#2c3e50' }}>
            {loading ? 'Processando...' : 'Atualizar Inbox'}
          </button>
        </section>

        {/* SEÇÃO 3: WHATSAPP (QR CODE) */}
        <section style={{ ...cardConfigStyle, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h3>📱 Conexão WhatsApp</h3>
              <p style={subTextStyle}>Escaneie o código para vincular o WhatsApp da Acorrea.</p>
              <div style={statusBadgeStyle(statusWA)}>
                {statusWA === 'desconectado' && '⚪ Aguardando Inicialização...'}
                {statusWA === 'conectando' && '🟡 Escaneie o QR Code ao lado'}
                {statusWA === 'pronto' && '🟢 WhatsApp Conectado'}
              </div>
              <p style={{ fontSize: '11px', color: '#999', marginTop: '10px' }}>
                A sessão será salva automaticamente. Você só precisará ler o QR Code novamente se desconectar manualmente no celular.
              </p>
            </div>

            <div style={qrContainerStyle}>
              {statusWA === 'pronto' ? (
                <div style={{ textAlign: 'center', color: '#28a745' }}>
                  <div style={{ fontSize: '50px' }}>✅</div>
                  <strong>Aparelho Conectado</strong>
                </div>
              ) : qrCode ? (
                <QRCodeSVG value={qrCode} size={180} />
              ) : (
                <div style={{ color: '#999', textAlign: 'center' }}>Gerando código...</div>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

// Estilos adicionais para o WhatsApp
const statusBadgeStyle = (status: string) => ({
  padding: '10px',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 'bold' as 'bold',
  backgroundColor: status === 'pronto' ? '#d4edda' : status === 'conectando' ? '#fff3cd' : '#eee',
  color: status === 'pronto' ? '#155724' : status === 'conectando' ? '#856404' : '#666',
  marginTop: '10px'
});

const qrContainerStyle = {
  padding: '20px',
  background: '#f9f9f9',
  border: '1px solid #eee',
  borderRadius: '12px',
  minWidth: '220px',
  minHeight: '220px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

// Seus estilos originais
const cardConfigStyle = { padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' as 'bold', marginTop: '15px' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as 'border-box' };
const subTextStyle = { fontSize: '12px', color: '#666', marginBottom: '15px' };
const btnPrimaryStyle = { width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' as 'bold' };
const btnBackStyle = { background: 'none', border: '1px solid #1a3353', color: '#1a3353', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' };