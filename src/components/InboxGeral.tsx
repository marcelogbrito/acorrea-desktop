  import { useEffect, useState } from 'react'
  import { supabase } from '../lib/supabase'

  export function InboxGeral({ onVincular }: { onVincular: () => void }) {
    const [comunicacoes, setComunicacoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [clientes, setClientes] = useState<any[]>([])
    const [modelos, setModelos] = useState<any[]>([])
    
    const [msgParaVincular, setMsgParaVincular] = useState<any | null>(null)
    const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null)
    const [resposta, setResposta] = useState('')
    const [enviando, setEnviando] = useState(false)
const [progresso, setProgresso] = useState<{ atual: number, total: number } | null>(null);

useEffect(() => {
  fetchClientes();
  fetchModelos();
  fetchInbox();

  // @ts-ignore
  if (window.acorreaAPI?.onInboxProgresso) {
    // Tipamos o parâmetro 'dados' aqui para evitar o 'any'
    // @ts-ignore
    const unsubscribe = window.acorreaAPI.onInboxProgresso((dados: { atual: number, total: number }) => {
      setProgresso(dados);
      setLoading(false); // Libera a tela assim que o primeiro sinal de vida da Locaweb chegar
      
      if (dados.atual === dados.total) {
        fetchInbox(); // Recarrega a lista quando terminar 100%
      }
    });

    return () => unsubscribe(); // Executa o cleanup ao desmontar a tela
  }
}, []);

    async function fetchInbox() {
      setLoading(true)
      const { data } = await supabase
        .from('comunicacoes')
        .select('*')
        .is('cliente_id', null)
        .order('data_hora', { ascending: false })
      setComunicacoes(data || [])
      setLoading(false)
    }

    async function fetchClientes() {
      const { data } = await supabase.from('clientes').select('id, nome').order('nome')
      setClientes(data || [])
    }

    async function fetchModelos() {
      const { data } = await supabase.from('modelos_resposta').select('*').order('titulo')
      setModelos(data || [])
    }

    const handleVincular = async () => {
      if (!clienteSelecionado || !msgParaVincular) return
      const { error } = await supabase
        .from('comunicacoes')
        .update({ cliente_id: clienteSelecionado, tags: ['cliente_vinculado_manualmente'] })
        .eq('remetente_identificador', msgParaVincular.remetente_identificador)

      if (!error) {
        alert("Remetente vinculado! O sistema aprenderá este contato para as próximas mensagens.")
        setMsgParaVincular(null)
        fetchInbox()
        onVincular()
      }
    }

    const handleResponder = async () => {
      if (!resposta || !msgParaVincular) return
      setEnviando(true)
      try {
        if (msgParaVincular.tipo === 'whatsapp') {
          // @ts-ignore
          await window.acorreaAPI.enviarWhatsApp({
            telefone: msgParaVincular.remetente_identificador,
            mensagem: resposta
          })
        } else {
          // @ts-ignore
          await window.acorreaAPI.enviarEmail({
            para: msgParaVincular.remetente_identificador,
            assunto: `Re: ${msgParaVincular.assunto}`,
            conteudo: resposta
          })
        }

        await supabase.from('comunicacoes').insert({
          cliente_id: msgParaVincular.cliente_id,
          tipo: msgParaVincular.tipo,
          direcao: 'saida',
          remetente_identificador: 'atendimento@acorrea.com.br',
          destinatario_identificador: msgParaVincular.remetente_identificador,
          conteudo: resposta,
          data_hora: new Date()
        })

        alert('Resposta enviada!')
        setResposta('')
      } catch (err) {
        alert('Erro ao enviar. Verifique a conexão com o serviço.')
      } finally {
        setEnviando(false)
      }
    }

    if (loading) return <div style={{ padding: '20px' }}>Carregando Inbox...</div>

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', height: 'calc(100vh - 160px)' }}>
        {progresso && (
  <div style={progressContainerStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ fontSize: '11px' }}>Sincronizando e-mails da Locaweb...</span>
      <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{progresso.atual} / {progresso.total}</span>
    </div>
    <div style={progressBarOuterStyle}>
      <div style={{ 
        ...progressBarInnerStyle, 
        width: `${(progresso.atual / progresso.total) * 100}%` 
      }} />
    </div>
  </div>
)}
        {/* SIDEBAR: LISTA DE MENSAGENS */}
        <aside style={sidebarStyle}>
          <div style={sidebarHeaderStyle}>📥 Triagem de Entrada</div>
          {comunicacoes.map(msg => (
            <div key={msg.id} onClick={() => {setMsgParaVincular(msg); setResposta('');}} style={{ 
              ...msgItemStyle, 
              backgroundColor: msgParaVincular?.id === msg.id ? '#f0f7ff' : 'transparent',
              borderLeft: msg.tags?.includes('ALTA') ? '4px solid #d9534f' : '4px solid transparent'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{msg.tipo.toUpperCase()}</span>
                <span>{new Date(msg.data_hora).toLocaleDateString()}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{msg.remetente_nome || msg.remetente_identificador}</div>
              <div style={previewStyle}>{msg.assunto || msg.conteudo}</div>
            </div>
          ))}
        </aside>

        {/* MAIN: LEITURA E RESPOSTA */}
        <main style={mainContainerStyle}>
          {msgParaVincular ? (
            <>
              <div style={headerContentStyle}>
                <h3>{msgParaVincular.assunto || 'Mensagem Recebida'}</h3>
                <p>De: {msgParaVincular.remetente_nome} ({msgParaVincular.remetente_identificador})</p>
              </div>

              <div style={bodyContentStyle}>{msgParaVincular.conteudo}</div>

              {/* AREA DE RESPOSTA COM MODELOS */}
              <div style={replySectionStyle}>
                <div style={modelRowStyle}>
                  {modelos.map(m => (
                    <button key={m.id} onClick={() => setResposta(m.conteudo)} style={btnModeloStyle}>⚡ {m.titulo}</button>
                  ))}
                </div>
                <textarea 
                  style={textareaStyle} 
                  placeholder="Digite sua resposta..." 
                  value={resposta} 
                  onChange={(e) => setResposta(e.target.value)} 
                />
                <button onClick={handleResponder} disabled={enviando || !resposta} style={{ 
                  ...btnSendStyle, 
                  backgroundColor: msgParaVincular.tipo === 'whatsapp' ? '#25D366' : '#007bff' 
                }}>
                  {enviando ? 'Enviando...' : `Enviar via ${msgParaVincular.tipo}`}
                </button>
              </div>

              {/* VINCULO MANUAL */}
              <div style={vincularBoxStyle}>
                <select style={selectStyle} value={clienteSelecionado || ''} onChange={e => setClienteSelecionado(e.target.value)}>
                  <option value="">Vincular a qual condomínio?</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button onClick={handleVincular} disabled={!clienteSelecionado} style={btnVincularStyle}>Vincular Remetente</button>
              </div>
            </>
          ) : (
            <div style={emptyStateStyle}>Selecione uma comunicação para processar.</div>
          )}
        </main>
      </div>
    )
  }

  // Estilos Consolidados
  const sidebarStyle = { backgroundColor: 'white', borderRadius: '8px', overflowY: 'auto' as 'auto', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
  const sidebarHeaderStyle = { padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold', backgroundColor: '#f8f9fa' };
  const msgItemStyle = { padding: '12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', transition: '0.2s' };
  const previewStyle = { fontSize: '12px', color: '#888', whiteSpace: 'nowrap' as 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const mainContainerStyle = { backgroundColor: 'white', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column' as 'column', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
  const headerContentStyle = { borderBottom: '1px solid #eee', marginBottom: '15px' };
  const bodyContentStyle = { flex: 1, overflowY: 'auto' as 'auto', backgroundColor: '#fdfdfd', padding: '15px', borderRadius: '4px', border: '1px solid #eee', fontSize: '14px', whiteSpace: 'pre-wrap' as 'pre-wrap' };
  const replySectionStyle = { marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' };
  const modelRowStyle = { display: 'flex', gap: '8px', marginBottom: '10px', overflowX: 'auto' as 'auto' };
  const btnModeloStyle = { padding: '5px 10px', fontSize: '11px', borderRadius: '15px', border: '1px solid #ddd', cursor: 'pointer', backgroundColor: '#fff' };
  const textareaStyle = { width: '100%', height: '80px', borderRadius: '4px', border: '1px solid #ddd', padding: '10px', marginBottom: '10px', resize: 'none' as 'none' };
  const btnSendStyle = { width: '100%', padding: '10px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
  const vincularBoxStyle = { marginTop: '15px', display: 'flex', gap: '10px', borderTop: '1px solid #eee', paddingTop: '15px' };
  const selectStyle = { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' };
  const btnVincularStyle = { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' };
  const emptyStateStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#bbb' };
  const progressContainerStyle = { padding: '15px', backgroundColor: '#fff', borderBottom: '1px solid #eee' };
const progressBarOuterStyle = { width: '100%', height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' };
const progressBarInnerStyle = { height: '100%', backgroundColor: '#28a745', transition: 'width 0.3s ease' };