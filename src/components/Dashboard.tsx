import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface DashboardProps {
  onSelecionarCliente: (clienteId: string) => void;
}

export function Dashboard({ onSelecionarCliente }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState({
    receitasPendentes: [] as any[],
    despesasPendentes: [] as any[],
    vistoriasAgendadas: [] as any[],
    orcamentosAguardando: [] as any[],
    osEmAberto: [] as any[]
  })

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true)
      try {
        // 1. Receitas a Receber (situacao = 'a_receber')
        const { data: receitas } = await supabase
          .from('receitas')
          .select('*, clientes(nome)')
          .eq('situacao', 'a_receber')
          .order('data_vencimento', { ascending: true })

        // 2. Despesas a Pagar (situacao = 'a_pagar')
        const { data: despesas } = await supabase
          .from('despesas')
          .select('*, fornecedores_prestadores(nome_razao_social)')
          .eq('situacao', 'a_pagar')
          .order('data_vencimento', { ascending: true })

        // 3. Vistorias Agendadas (situacao = 'agendada')
        const { data: vistorias } = await supabase
          .from('vistoria_previa_avcb')
          .select('*, clientes(nome)')
          .eq('situacao', 'agendada')
          .order('data_agendamento', { ascending: true })

        // 4. Orçamentos Aguardando (situacao_orcamento = 'Aguardando')
        const { data: orcamentos } = await supabase
          .from('orcamentos')
          .select('*, clientes(nome)')
          .eq('situacao_orcamento', 'Aguardando')

        // 5. Ordens de Serviço (situacao = 'agendada')
        const { data: os } = await supabase
          .from('ordens_de_servico')
          .select('*, clientes(nome)')
          .eq('situacao', 'agendada')
          .order('data_hora_prevista', { ascending: true })

        setMetricas({
          receitasPendentes: receitas || [],
          despesasPendentes: despesas || [],
          vistoriasAgendadas: vistorias || [],
          orcamentosAguardando: orcamentos || [],
          osEmAberto: os || []
        })
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>🔄 Sincronizando Pendências...</div>

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      <h2 style={{ marginBottom: '25px', color: '#1a3353' }}>📊 Central de Pendências - Acorrea</h2>

      {/* CARDS DE RESUMO SUPERIOR */}
      <div style={statsGrid}>
        <div style={{ ...statCard, borderLeft: '5px solid #d9534f' }}>
          <span style={labelStyle}>RECEITAS A RECEBER</span>
          <h3 style={valueStyle}>R$ {metricas.receitasPendentes.reduce((acc, curr) => acc + Number(curr.valor_parcela || curr.valor_receber), 0).toLocaleString('pt-BR')}</h3>
        </div>
        <div style={{ ...statCard, borderLeft: '5px solid #333' }}>
          <span style={labelStyle}>DESPESAS A PAGAR</span>
          <h3 style={valueStyle}>R$ {metricas.despesasPendentes.reduce((acc, curr) => acc + Number(curr.valor_pagar), 0).toLocaleString('pt-BR')}</h3>
        </div>
        <div style={{ ...statCard, borderLeft: '5px solid #5bc0de' }}>
          <span style={labelStyle}>ORÇAMENTOS AGUARDANDO</span>
          <h3 style={valueStyle}>{metricas.orcamentosAguardando.length}</h3>
        </div>
        <div style={{ ...statCard, borderLeft: '5px solid #0275d8' }}>
          <span style={labelStyle}>OS AGENDADAS</span>
          <h3 style={valueStyle}>{metricas.osEmAberto.length}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginTop: '25px' }}>
        
        {/* BLOCO FINANCEIRO */}
        <section style={panelStyle}>
          <h4 style={panelTitle}>💰 Fluxo Financeiro</h4>
          
          <div style={listHeaderStyle}>RECEITAS A RECEBER ({metricas.receitasPendentes.length})</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {metricas.receitasPendentes.map(r => (
              <div key={r.id} style={listItem} onClick={() => onSelecionarCliente(r.cliente_id)}>
                <span style={clientNameLinkStyle}>{r.clientes?.nome}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold' }}>R$ {Number(r.valor_parcela || r.valor_receber).toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: '10px', color: '#d9534f' }}>Venc: {new Date(r.data_vencimento).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...listHeaderStyle, marginTop: '20px' }}>DESPESAS A PAGAR ({metricas.despesasPendentes.length})</div>
          {metricas.despesasPendentes.map(d => (
            <div key={d.id} style={listItem}>
              <span style={{ color: '#c9302c' }}>{d.fornecedores_prestadores?.nome_razao_social || 'Fornecedor'}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold' }}>R$ {Number(d.valor_pagar).toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: '10px' }}>Venc: {new Date(d.data_vencimento).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </section>

        {/* BLOCO ENGENHARIA / OPERACIONAL */}
        <section style={panelStyle}>
          <h4 style={panelTitle}>🏗️ Engenharia e Orçamentos</h4>

          <div style={listHeaderStyle}>ORÇAMENTOS A APROVAR ({metricas.orcamentosAguardando.length})</div>
          {metricas.orcamentosAguardando.map(o => (
            <div key={o.id} style={listItem} onClick={() => onSelecionarCliente(o.cliente_id)}>
              <span style={clientNameLinkStyle}>{o.clientes?.nome}</span>
              <span style={{ fontWeight: 'bold' }}>R$ {Number(o.valor).toLocaleString('pt-BR')}</span>
            </div>
          ))}

          <div style={{ ...listHeaderStyle, marginTop: '20px' }}>PRÓXIMAS ORDENS DE SERVIÇO ({metricas.osEmAberto.length})</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {metricas.osEmAberto.map(os => (
              <div key={os.id} style={listItem} onClick={() => onSelecionarCliente(os.cliente_id)}>
                <div>
                  <div style={clientNameLinkStyle}>{os.clientes?.nome}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{os.observacoes}</div>
                </div>
                <span style={badgeStyle}>{new Date(os.data_hora_prevista).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          <div style={{ ...listHeaderStyle, marginTop: '20px' }}>VISTORIAS AGENDADAS ({metricas.vistoriasAgendadas.length})</div>
          {metricas.vistoriasAgendadas.map(v => (
            <div key={v.id} style={listItem} onClick={() => onSelecionarCliente(v.cliente_id)}>
              <span style={clientNameLinkStyle}>{v.clientes?.nome || v.nome_edificacao}</span>
              <span style={{ color: '#f0ad4e', fontWeight: 'bold' }}>📅 {new Date(v.data_agendamento).toLocaleDateString()}</span>
            </div>
          ))}
        </section>

      </div>
    </div>
  )
}

// ESTILOS
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' };
const statCard = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', color: '#888', fontWeight: 'bold', letterSpacing: '0.5px' };
const valueStyle = { margin: '5px 0 0 0', fontSize: '24px', color: '#1a3353' };
const panelStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' };
const panelTitle = { borderBottom: '2px solid #f0f2f5', paddingBottom: '12px', marginTop: 0, color: '#1a3353', fontSize: '18px' };
const listHeaderStyle = { fontSize: '11px', fontWeight: 'bold', color: '#555', backgroundColor: '#f8f9fa', padding: '5px 10px', borderRadius: '4px', marginBottom: '10px' };
const listItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #f2f2f2', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s' };
const clientNameLinkStyle = { fontWeight: 500, color: '#007bff', flex: 1 };
const badgeStyle = { backgroundColor: '#e7f3ff', color: '#007bff', padding: '4px 12px', borderRadius: '15px', fontSize: '10px', fontWeight: 'bold' };