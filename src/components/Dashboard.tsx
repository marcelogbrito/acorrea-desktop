import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface DashboardProps {
  onSelecionarCliente: (clienteId: string) => void;
}

// Tipo para controlar o filtro ativo do painel
type FiltroDashboard = 'todos' | 'orcamentos' | 'vistorias' | 'os' | 'lembretes';

export function Dashboard({ onSelecionarCliente }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroDashboard>('todos')
  const [lembretes, setLembretes] = useState<any[]>([])
  const [metricas, setMetricas] = useState({
    receitasPendentes: [] as any[],
    despesasPendentes: [] as any[],
    vistoriasAgendadas: [] as any[],
    orcamentosAguardando: [] as any[],
    osAgendadas: [] as any[]
  })

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const [resRec, resDesp, resVist, resOrc, resOs, resLemb] = await Promise.all([
        supabase.from('receitas').select('*, clientes(nome)').eq('situacao', 'a_receber').order('data_vencimento', { ascending: true }),
        supabase.from('despesas').select('*, fornecedores_prestadores(nome_razao_social)').eq('situacao', 'a_pagar').order('data_vencimento', { ascending: true }),
        supabase.from('vistoria_previa_avcb').select('*, clientes(nome)').eq('situacao', 'agendada').order('data_agendamento', { ascending: true }),
        supabase.from('orcamentos').select('*, clientes(nome)').eq('situacao_orcamento', 'Aguardando'),
        supabase.from('ordens_de_servico').select('*, clientes(nome)').eq('situacao', 'agendada').order('data_hora_prevista', { ascending: true }),
        supabase.from('lembretes').select('*, clientes(nome)').eq('concluido', false).order('data_lembrete', { ascending: true })
      ])

      setMetricas({
        receitasPendentes: resRec.data || [],
        despesasPendentes: resDesp.data || [],
        vistoriasAgendadas: resVist.data || [],
        orcamentosAguardando: resOrc.data || [],
        osAgendadas: resOs.data || []
      })
      setLembretes(resLemb.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Função para concluir lembrete
  const concluirLembrete = async (id: string) => {
    try {
      const { error } = await supabase.from('lembretes').update({ concluido: true }).eq('id', id);
      if (error) throw error;
      setLembretes(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      alert("Erro ao concluir: " + err.message);
    }
  };

  // Lógica de cores para prazos (Hoje, Atrasado, Futuro)
  const getBadgeStyle = (dataStr: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAlvo = new Date(dataStr);
    dataAlvo.setHours(0, 0, 0, 0);

    if (dataAlvo.getTime() === hoje.getTime()) {
      return { backgroundColor: '#d9534f', color: 'white', fontWeight: 'bold' }; // HOJE: Vermelho
    } else if (dataAlvo.getTime() < hoje.getTime()) {
      return { backgroundColor: '#f0ad4e', color: 'white' }; // ATRASADO: Laranja
    }
    return { backgroundColor: '#e7f3ff', color: '#007bff' }; // FUTURO: Azul
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>🔄 Sincronizando Painel Operacional...</div>

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ margin: 0, color: '#1a3353' }}>📊 Painel de Controle Operacional</h2>
        {filtroAtivo !== 'todos' && (
          <button onClick={() => setFiltroAtivo('todos')} style={btnLimparFiltro}>Limpar Filtros ✕</button>
        )}
      </div>

      {/* CARDS DE INDICADORES (CLICÁVEIS PARA FILTRAR) */}
      <div style={statsGrid}>
        <div onClick={() => setFiltroAtivo('orcamentos')} style={{ ...statCard, borderLeft: '5px solid #d9534f', cursor: 'pointer', opacity: filtroAtivo === 'orcamentos' || filtroAtivo === 'todos' ? 1 : 0.5 }}>
          <span style={labelStyle}>ORÇAMENTOS PENDENTES</span>
          <h3 style={valueStyle}>{metricas.orcamentosAguardando.length}</h3>
        </div>
        <div onClick={() => setFiltroAtivo('vistorias')} style={{ ...statCard, borderLeft: '5px solid #f0ad4e', cursor: 'pointer', opacity: filtroAtivo === 'vistorias' || filtroAtivo === 'todos' ? 1 : 0.5 }}>
          <span style={labelStyle}>VISTORIAS AGENDADAS</span>
          <h3 style={valueStyle}>{metricas.vistoriasAgendadas.length}</h3>
        </div>
        <div onClick={() => setFiltroAtivo('os')} style={{ ...statCard, borderLeft: '5px solid #0275d8', cursor: 'pointer', opacity: filtroAtivo === 'os' || filtroAtivo === 'todos' ? 1 : 0.5 }}>
          <span style={labelStyle}>ORDENS DE SERVIÇO</span>
          <h3 style={valueStyle}>{metricas.osAgendadas.length}</h3>
        </div>
        <div onClick={() => setFiltroAtivo('lembretes')} style={{ ...statCard, borderLeft: '5px solid #28a745', cursor: 'pointer', opacity: filtroAtivo === 'lembretes' || filtroAtivo === 'todos' ? 1 : 0.5 }}>
          <span style={labelStyle}>LEMBRETES ATIVOS</span>
          <h3 style={valueStyle}>{lembretes.length}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '25px' }}>
        
        {/* COLUNA ESQUERDA: LEMBRETES E FINANCEIRO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {(filtroAtivo === 'todos' || filtroAtivo === 'lembretes') && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>🔔 Lembretes de Hoje</h4>
              {lembretes.map(l => (
                <div key={l.id} style={listItemLembrete}>
                  <div style={{ flex: 1 }} onClick={() => onSelecionarCliente(l.cliente_id)}>
                    <div style={{ fontWeight: 'bold', color: '#007bff', cursor: 'pointer' }}>{l.clientes?.nome}</div>
                    <div style={{ fontSize: '13px' }}>{l.titulo}</div>
                  </div>
                  <button onClick={() => concluirLembrete(l.id)} style={btnConcluirStyle}>Concluir ✓</button>
                </div>
              ))}
            </section>
          )}

          {filtroAtivo === 'todos' && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>💰 Receitas a Receber</h4>
              {metricas.receitasPendentes.map(r => (
                <div key={r.id} style={listItem} onClick={() => onSelecionarCliente(r.cliente_id)}>
                  <span style={clientNameLinkStyle}>{r.clientes?.nome}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>R$ {Number(r.valor_parcela || r.valor_receber).toLocaleString('pt-BR')}</div>
                    <div style={{ fontSize: '10px', color: '#d9534f' }}>Venc: {new Date(r.data_vencimento).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {(filtroAtivo === 'todos' || filtroAtivo === 'os') && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>🛠️ Ordens de Serviço</h4>
              {metricas.osAgendadas.map(os => {
                const style = getBadgeStyle(os.data_hora_prevista);
                return (
                  <div key={os.id} style={listItem} onClick={() => onSelecionarCliente(os.cliente_id)}>
                    <div>
                      <div style={clientNameLinkStyle}>{os.clientes?.nome}</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>{os.observacoes}</div>
                    </div>
                    <span style={{ ...badgeStyle, ...style }}>{new Date(os.data_hora_prevista).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* COLUNA DIREITA: OPERACIONAL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          

          {(filtroAtivo === 'todos' || filtroAtivo === 'vistorias') && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>🕵️ Vistorias Agendadas</h4>
              {metricas.vistoriasAgendadas.map(v => {
                const style = getBadgeStyle(v.data_agendamento);
                return (
                  <div key={v.id} style={listItem} onClick={() => onSelecionarCliente(v.cliente_id)}>
                    <span style={clientNameLinkStyle}>{v.clientes?.nome}</span>
                    <span style={{ ...badgeStyle, ...style }}>📅 {new Date(v.data_agendamento).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </section>
          )}

          {(filtroAtivo === 'todos' || filtroAtivo === 'orcamentos') && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>📋 Orçamentos Aguardando</h4>
              {metricas.orcamentosAguardando.map(o => (
                <div key={o.id} style={listItem} onClick={() => onSelecionarCliente(o.cliente_id)}>
                  <span style={clientNameLinkStyle}>{o.clientes?.nome}</span>
                  <strong>R$ {Number(o.valor).toLocaleString('pt-BR')}</strong>
                </div>
              ))}
            </section>
          )}
        </div>

      </div>
    </div>
  )
}

// ESTILOS
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' };
const statCard = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.3s' };
const labelStyle = { fontSize: '10px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' };
const valueStyle = { margin: '5px 0 0 0', fontSize: '22px', color: '#1a3353' };
const panelStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' };
const panelTitle = { borderBottom: '2px solid #f0f2f5', paddingBottom: '12px', marginTop: 0, color: '#1a3353', fontSize: '17px' };
const listItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #f2f2f2', fontSize: '13px', cursor: 'pointer' };
const listItemLembrete = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f2f2f2' };
const clientNameLinkStyle = { fontWeight: 500, color: '#007bff', flex: 1 };
const btnConcluirStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' };
const badgeStyle = { backgroundColor: '#e7f3ff', color: '#007bff', padding: '4px 12px', borderRadius: '15px', fontSize: '10px', fontWeight: 'bold' };
const btnLimparFiltro = { padding: '5px 12px', borderRadius: '4px', border: '1px solid #d9534f', color: '#d9534f', background: 'white', cursor: 'pointer', fontSize: '12px' };