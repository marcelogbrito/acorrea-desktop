//src\App.tsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { Configuracoes } from './components/Configuracoes'
import { ModalEmissao } from './components/ModalEmissao'
import { Visao360 } from './components/Visao360'
import { Dashboard } from './components/Dashboard'
import { InboxGeral } from './components/InboxGeral' // Importe o novo componente

type Pagina = 'dashboard' | 'clientes' | 'inbox' | 'config';

function App() {
  const [session, setSession] = useState<any>(null)
  const [view, setView] = useState<Pagina>('dashboard')
  const [clientes, setClientes] = useState<any[]>([])
  const [parceiros, setParceiros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [contagemPendentes, setContagemPendentes] = useState(0)
  
  const [filtroBusca, setFiltroBusca] = useState('')
  const [clienteParaEmissao, setClienteParaEmissao] = useState<any | null>(null)
  const [clienteAtivo, setClienteAtivo] = useState<any | null>(null)

  // ESTADO ATUALIZADO COM O CAMPO ENDEREÇO
  const [novoCliente, setNovoCliente] = useState({ nome: '', cnpj_cpf: '', parceiro_id: '', endereco: '' })

  async function fetchData() {
    setLoading(true)
    try {
      const resClientes = await supabase.from('clientes').select('*, parceiro:parceiro_id(nome)').order('nome')
      setClientes(resClientes.data || [])

      const resParceiros = await supabase.from('clientes').select('id, nome').eq('parceiro', true)
      setParceiros(resParceiros.data || [])

      // Busca contagem de mensagens não vinculadas
      const { count } = await supabase.from('comunicacoes').select('*', { count: 'exact', head: true }).is('cliente_id', null)
      setContagemPendentes(count || 0)
    } finally {
      setLoading(false)
    }
  }

  // FUNÇÃO DE CADASTRO ATUALIZADA
  const handleCadastrarCliente = async () => {
    if (!novoCliente.nome || !novoCliente.cnpj_cpf) {
      return alert("Nome e CNPJ/CPF são obrigatórios.");
    }

    setLoading(true); // Trava os botões para evitar duplo clique
    try {
      const { error } = await supabase
        .from('clientes')
        .insert([{
          nome: novoCliente.nome.toUpperCase(),
          cnpj_cpf: novoCliente.cnpj_cpf.replace(/\D/g, ''),
          endereco: novoCliente.endereco, // NOVO CAMPO SALVO NO BANCO
          parceiro_id: novoCliente.parceiro_id || null,
        }]);

      if (error) throw error;

      alert("✅ Cliente cadastrado com sucesso!");
      // RESET ATUALIZADO
      setNovoCliente({ nome: '', cnpj_cpf: '', parceiro_id: '', endereco: '' });
      
      // Resetamos o loading ANTES de buscar os novos dados para liberar a UI
      setLoading(false); 
      await fetchData(); 
    } catch (err: any) {
      setLoading(false);
      alert("❌ Erro ao cadastrar: " + (err.message || "Verifique os dados"));
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchData()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchData()
    })
    return () => subscription.unsubscribe()
  }, [])

  const confirmarEmissao = async (dados: { valor: string, descricao: string }) => {
    const cliente = clienteParaEmissao;
    setClienteParaEmissao(null); 
    try {
      const { data: creds } = await supabase.from('credenciais_servicos').select('*').eq('servico', 'ginfes_santo_andre').single();
      // @ts-ignore
      await window.acorreaAPI.abrirGinfes({
        usuario: creds.usuario, senha_hash: creds.senha_hash,
        clienteCnpj: cliente.cnpj_cpf, valorNota: dados.valor, descricaoServico: dados.descricao
      });
    } catch (err) { console.error(err); }
  };

  if (!session) return <Login onLogin={() => { }} />

  if (clienteAtivo) {
    return (
      <Visao360 
  cliente={clienteAtivo} 
  onBack={() => setClienteAtivo(null)} 
  onSolicitarEmissao={async (cli, dados) => {
    try {
      // 1. Busca a credencial do Ginfes no banco
      const { data: creds, error } = await supabase
        .from('credenciais_servicos')
        .select('*')
        .eq('servico', 'ginfes_santo_andre')
        .single();

      if (error || !creds) {
        alert("Credenciais do Ginfes não encontradas!");
        return;
      }

      // 2. CHAMA O ROBÔ (window.acorreaAPI definida no seu preload.ts)
      // @ts-ignore
      const resultado = await window.acorreaAPI.abrirGinfes({
        usuario: creds.usuario,
        senha_hash: creds.senha_hash,
        clienteCnpj: cli.cnpj_cpf,
        valorNota: dados.valor,
        descricaoServico: dados.descricao
      });

      alert(resultado);
    } catch (err: any) {
      alert("Erro ao disparar automação: " + err.message);
    }
  }}
/>
    )
  }

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', color: '#333' }}>
      
      <nav style={navStyle}>
        <h2 style={{ margin: 0, fontSize: '20px', marginRight: '20px' }}>Acorrea Gestão</h2>
        
        <button onClick={() => setView('dashboard')} style={view === 'dashboard' ? activeTabStyle : tabStyle}>📊 Dashboard</button>
        <button onClick={() => setView('clientes')} style={view === 'clientes' ? activeTabStyle : tabStyle}>👥 Clientes</button>
        <button onClick={() => setView('inbox')} style={view === 'inbox' ? activeTabStyle : tabStyle}>
          📥 Inbox {contagemPendentes > 0 && <span style={badgeStyle}>{contagemPendentes}</span>}
        </button>
        <button onClick={() => setView('config')} style={view === 'config' ? activeTabStyle : tabStyle}>⚙️ Config</button>

        <button onClick={() => supabase.auth.signOut()} style={btnSairStyle}>Sair</button>
      </nav>

      <main style={{ padding: '25px' }}>
        {view === 'dashboard' && <Dashboard onSelecionarCliente={(id) => {
            const cli = clientes.find(c => c.id === id);
            if (cli) setClienteAtivo(cli);
        }} />}

        {view === 'inbox' && <InboxGeral onVincular={fetchData} />}

        {view === 'config' && <Configuracoes onBack={() => setView('dashboard')} />}

        {view === 'clientes' && (
          <>
            <section style={formSectionStyle}>
              <h3>➕ Novo Cadastro</h3>
              {/* GRID ATUALIZADA PARA INCLUIR ENDEREÇO (5 COLUNAS) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 2fr auto', gap: '15px', alignItems: 'end' }}>
                <input placeholder="Nome/Condomínio" style={inputStyle} value={novoCliente.nome} onChange={e => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                <input placeholder="CPF/CNPJ" style={inputStyle} value={novoCliente.cnpj_cpf} onChange={e => setNovoCliente({ ...novoCliente, cnpj_cpf: e.target.value })} />
                <select style={inputStyle} value={novoCliente.parceiro_id} onChange={e => setNovoCliente({ ...novoCliente, parceiro_id: e.target.value })}>
                  <option value="">Atendimento Direto</option>
                  {parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                
                {/* NOVO CAMPO DE ENDEREÇO */}
                <input placeholder="Endereço (Opcional)" style={inputStyle} value={novoCliente.endereco} onChange={e => setNovoCliente({ ...novoCliente, endereco: e.target.value })} />
                
                <button onClick={handleCadastrarCliente} style={btnGreenStyle} disabled={loading}>
            {loading ? 'Processando...' : 'Cadastrar'}
          </button>
              </div>
            </section>

            <div style={{ marginBottom: '20px' }}>
              <input type="text" placeholder="🔍 Buscar condomínio..." style={{ ...inputStyle, width: '100%', padding: '12px' }} value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
            </div>

            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: 'left', backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '15px' }}>Condomínio</th>
                  <th style={{ padding: '15px' }}>CNPJ</th>
                  <th style={{ padding: '15px' }}>Parceiro</th>
                  <th style={{ padding: '15px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.filter(c => c.nome?.toLowerCase().includes(filtroBusca.toLowerCase()) || c.cnpj_cpf?.includes(filtroBusca)).map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '15px' }}><strong>{c.nome}</strong></td>
                      <td style={{ padding: '15px', color: '#666' }}>{c.cnpj_cpf}</td>
                      <td style={{ padding: '15px' }}>{c.parceiro?.nome || 'Direto'}</td>
                      <td style={{ padding: '15px' }}><button onClick={() => setClienteAtivo(c)} style={btnPurpleStyle}>🔍 Visão 360°</button></td>
                    </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>

      {clienteParaEmissao && <ModalEmissao cliente={clienteParaEmissao} onCancel={() => setClienteParaEmissao(null)} onConfirm={confirmarEmissao} />}
    </div>
  )
}

const navStyle = { display: 'flex', gap: '20px', padding: '15px 25px', backgroundColor: '#1a3353', color: 'white', alignItems: 'center' };
const badgeStyle = { backgroundColor: '#d9534f', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', marginLeft: '5px' };
const btnSairStyle = { marginLeft: 'auto', background: 'none', border: '1px solid #fff', color: '#fff', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' };
const tabStyle = { background: 'none', border: 'none', color: '#b0c4de', cursor: 'pointer', fontSize: '15px', padding: '10px' };
const activeTabStyle = { ...tabStyle, color: '#fff', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #fff' };
const formSectionStyle = { backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '30px' };
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' };
const btnGreenStyle = { padding: '12px 25px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const btnPurpleStyle = { padding: '6px 15px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };

export default App