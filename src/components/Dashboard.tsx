import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface DashboardProps {
  onSelecionarCliente: (clienteId: string) => void;
}

type FiltroDashboard = 'todos' | 'orcamentos' | 'vistorias' | 'os' | 'lembretes';

export function Dashboard({ onSelecionarCliente }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroDashboard>('todos')
  
  const [lembretes, setLembretes] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([]) 
  const [clientes, setClientes] = useState<any[]>([]) // Novo: Lista completa de clientes para a busca
  
  const [filtroResponsavelId, setFiltroResponsavelId] = useState<string>('') 
  const [filtroResponsavelOsId, setFiltroResponsavelOsId] = useState<string>('') 
  
  const [metricas, setMetricas] = useState({
    receitasPendentes: [] as any[],
    despesasPendentes: [] as any[],
    vistoriasAgendadas: [] as any[],
    orcamentosAguardando: [] as any[],
    osAgendadas: [] as any[]
  })

  // Estados do Modal de Rotina/Lembrete Global
  const [abrirModalLembrete, setAbrirModalLembrete] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState(''); // Controla o texto digitado na busca
  const [lembreteForm, setLembreteForm] = useState({ 
    id: '', titulo: '', descricao: '', data_lembrete: '', prioridade: 'media', 
    responsaveis_ids: [] as string[], clientes_ids: [] as string[] 
  });

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const [resRec, resDesp, resVist, resOrc, resOs, resLemb, resProf, resCli] = await Promise.all([
        supabase.from('receitas').select('*, clientes(nome)').eq('situacao', 'a_receber').order('data_vencimento', { ascending: true }),
        supabase.from('despesas').select('*, fornecedores_prestadores(nome_razao_social)').eq('situacao', 'a_pagar').order('data_vencimento', { ascending: true }),
        supabase.from('vistoria_previa_avcb').select('*, clientes(nome)').eq('situacao', 'agendada').order('data_agendamento', { ascending: true }),
        supabase.from('orcamentos').select('*, clientes(nome)').eq('situacao_orcamento', 'Aguardando'),
        supabase.from('ordens_de_servico').select('*, clientes(nome)').eq('situacao', 'agendada').order('data_hora_prevista', { ascending: true }),
        supabase.from('lembretes').select('*, clientes(nome)').eq('concluido', false).order('data_lembrete', { ascending: true }),
        supabase.from('fornecedores_prestadores').select('id, nome_razao_social, tipo_fornecedor_prestador').not('tipo_fornecedor_prestador', 'is', null).order('nome_razao_social', { ascending: true }),
        supabase.from('clientes').select('id, nome').order('nome', { ascending: true }) // Busca todos os clientes para o combobox
      ])

      setMetricas({
        receitasPendentes: resRec.data || [], despesasPendentes: resDesp.data || [],
        vistoriasAgendadas: resVist.data || [], orcamentosAguardando: resOrc.data || [], osAgendadas: resOs.data || []
      })
      setLembretes(resLemb.data || [])
      setProfissionais(resProf.data || [])
      setClientes(resCli.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const concluirLembrete = async (id: string) => {
    try {
      const { error } = await supabase.from('lembretes').update({ concluido: true }).eq('id', id);
      if (error) throw error;
      setLembretes(prev => prev.filter(l => l.id !== id));
    } catch (err: any) { alert("Erro ao concluir: " + err.message); }
  };

  const alterarSituacaoVistoria = async (id: string, novaSituacao: string) => {
    try {
      const { error } = await supabase.from('vistoria_previa_avcb').update({ situacao: novaSituacao }).eq('id', id);
      if (error) throw error;
      fetchDashboardData();
    } catch (err: any) { alert("Erro ao atualizar situação: " + err.message); }
  };

  // ================= CRUD LEMBRETE GLOBAL (ROTINAS) =================
  const abrirFormLembreteGlobal = (lembrete?: any) => {
    if (lembrete) {
      setLembreteForm({
        id: lembrete.id, titulo: lembrete.titulo, descricao: lembrete.descricao || '',
        data_lembrete: lembrete.data_lembrete ? new Date(lembrete.data_lembrete).toISOString().slice(0, 16) : '',
        prioridade: lembrete.prioridade || 'media', 
        responsaveis_ids: lembrete.responsaveis_ids || [], 
        clientes_ids: lembrete.clientes_ids || (lembrete.cliente_id ? [lembrete.cliente_id] : []) // Migração visual de 1 para N
      });
    } else {
      setLembreteForm({ id: '', titulo: '', descricao: '', data_lembrete: '', prioridade: 'media', responsaveis_ids: [], clientes_ids: [] });
    }
    setBuscaCliente('');
    setAbrirModalLembrete(true);
  }

  const salvarLembreteGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        titulo: lembreteForm.titulo,
        descricao: lembreteForm.descricao,
        data_lembrete: lembreteForm.data_lembrete || null,
        prioridade: lembreteForm.prioridade,
        responsaveis_ids: lembreteForm.responsaveis_ids,
        clientes_ids: lembreteForm.clientes_ids,
        cliente_id: lembreteForm.clientes_ids.length === 1 ? lembreteForm.clientes_ids[0] : null // Se for só 1, salva no legado também
      };

      if (lembreteForm.id) await supabase.from('lembretes').update(payload).eq('id', lembreteForm.id);
      else await supabase.from('lembretes').insert([payload]);
      
      setAbrirModalLembrete(false);
      fetchDashboardData();
    } catch (err: any) { alert("Erro ao salvar: " + err.message); }
  }

  // Lógica da Busca de Clientes (Máx 5 resultados para não quebrar a tela)
  const clientesSugeridos = buscaCliente.length > 1 
    ? clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) && !lembreteForm.clientes_ids.includes(c.id)).slice(0, 5)
    : [];

  // Filtros Globais Dashboard
  const lembretesFiltrados = lembretes.filter(l => filtroResponsavelId === '' || (l.responsaveis_ids && l.responsaveis_ids.includes(filtroResponsavelId)));
  const osFiltradas = metricas.osAgendadas.filter(os => filtroResponsavelOsId === '' || (os.responsaveis_ids && os.responsaveis_ids.includes(filtroResponsavelOsId)));

  const getBadgeStyle = (dataStr: string) => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dataAlvo = new Date(dataStr); dataAlvo.setHours(0, 0, 0, 0);
    if (dataAlvo.getTime() === hoje.getTime()) return { backgroundColor: '#d9534f', color: 'white', fontWeight: 'bold' }; 
    else if (dataAlvo.getTime() < hoje.getTime()) return { backgroundColor: '#f0ad4e', color: 'white' }; 
    return { backgroundColor: '#e7f3ff', color: '#007bff' }; 
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>🔄 Sincronizando Painel Operacional...</div>

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      
      <div style={headerStyle}>
        <h2 style={{ margin: 0, color: '#1a3353' }}>📊 Painel de Controle Operacional</h2>
        {filtroAtivo !== 'todos' && <button onClick={() => setFiltroAtivo('todos')} style={btnLimparFiltro}>Limpar Filtros ✕</button>}
      </div>

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
          <span style={labelStyle}>LEMBRETES / ROTINAS</span>
          <h3 style={valueStyle}>{lembretes.length}</h3>
        </div>
      </div>

      <div style={mainColumnsGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {(filtroAtivo === 'todos' || filtroAtivo === 'lembretes') && (
            <section style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f0f2f5', paddingBottom: '12px', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, color: '#1a3353', fontSize: '17px' }}>🔔 Lembretes & Rotinas</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select style={{ ...selectStatusStyle, padding: '6px' }} value={filtroResponsavelId} onChange={(e) => setFiltroResponsavelId(e.target.value)}>
                    <option value="">Todos os Responsáveis</option>
                    {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome_razao_social}</option>)}
                  </select>
                  <button onClick={() => abrirFormLembreteGlobal()} style={btnGreenStyle}>+ Nova Rotina</button>
                </div>
              </div>

              {lembretesFiltrados.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhuma rotina para este filtro.</p>
              ) : (
                lembretesFiltrados.map(l => {
                  // Lógica de Renderização do Título do Cliente/Rotina
                  let textoIdentificacao = '🏢 Rotina Geral Interna';
                  let isClickable = false;
                  
                  if (l.cliente_id) {
                    textoIdentificacao = l.clientes?.nome || 'Cliente Desconhecido';
                    isClickable = true;
                  } else if (l.clientes_ids && l.clientes_ids.length > 0) {
                    textoIdentificacao = `📋 Rotina Múltipla (${l.clientes_ids.length} Condomínios vinculados)`;
                  }

                  return (
                    <div key={l.id} style={listItemLembrete}>
                      <div style={{ flex: 1 }}>
                        <div 
                          style={{ fontWeight: 'bold', color: isClickable ? '#007bff' : '#495057', cursor: isClickable ? 'pointer' : 'default' }}
                          onClick={() => isClickable && onSelecionarCliente(l.cliente_id)}
                        >
                          {textoIdentificacao}
                        </div>
                        <div style={{ fontSize: '13px', marginTop: '2px' }}>{l.titulo}</div>
                        
                        {/* Tags de Responsáveis */}
                        {l.responsaveis_ids && l.responsaveis_ids.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {l.responsaveis_ids.map((id: string) => {
                              const prof = profissionais.find(p => p.id === id);
                              return prof ? <span key={id} style={tagVisualStyle}>{prof.nome_razao_social}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <button onClick={() => abrirFormLembreteGlobal(l)} style={btnSmallStyle}>✏️</button>
                        <button onClick={() => concluirLembrete(l.id)} style={btnConcluirStyle}>Concluir ✓</button>
                      </div>
                    </div>
                  );
                })
              )}
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

          {/* ------------ ORDENS DE SERVIÇO ------------ */}
          {(filtroAtivo === 'todos' || filtroAtivo === 'os') && (
            <section style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f0f2f5', paddingBottom: '12px', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, color: '#1a3353', fontSize: '17px' }}>🛠️ Ordens de Serviço</h4>
                <select style={{ ...selectStatusStyle, padding: '6px' }} value={filtroResponsavelOsId} onChange={(e) => setFiltroResponsavelOsId(e.target.value)}>
                  <option value="">Todos os Responsáveis</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome_razao_social}</option>)}
                </select>
              </div>
              {osFiltradas.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>Nenhuma O.S. para este filtro.</p>
              ) : (
                osFiltradas.map(os => {
                  const style = getBadgeStyle(os.data_hora_prevista);
                  return (
                    <div key={os.id} style={listItem} onClick={() => onSelecionarCliente(os.cliente_id)}>
                      <div>
                        <div style={clientNameLinkStyle}>{os.clientes?.nome}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{os.observacoes}</div>
                        {os.responsaveis_ids && os.responsaveis_ids.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                            {os.responsaveis_ids.map((id: string) => {
                              const prof = profissionais.find(p => p.id === id);
                              return prof ? <span key={id} style={tagVisualStyle}>{prof.nome_razao_social}</span> : null;
                            })}
                          </div>
                        )}
                      </div>
                      <span style={{ ...badgeStyle, ...style }}>{new Date(os.data_hora_prevista).toLocaleDateString()}</span>
                    </div>
                  );
                })
              )}
            </section>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {(filtroAtivo === 'todos' || filtroAtivo === 'vistorias') && (
            <section style={panelStyle}>
              <h4 style={panelTitle}>🕵️ Vistorias Agendadas</h4>
              {metricas.vistoriasAgendadas.map(v => {
                const style = getBadgeStyle(v.data_agendamento);
                return (
                  <div key={v.id} style={listItem} >
                    <span style={{...clientNameLinkStyle, cursor: 'pointer'}} onClick={() => onSelecionarCliente(v.cliente_id)}>
                      {v.clientes?.nome}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ ...badgeStyle, ...style, cursor: 'pointer' }} onClick={() => onSelecionarCliente(v.cliente_id)}>
                        📅 {new Date(v.data_agendamento).toLocaleDateString()}
                      </span>
                      <select value={v.situacao || 'agendada'} onChange={(e) => alterarSituacaoVistoria(v.id, e.target.value)} style={selectStatusStyle}>
                        <option value="agendada">⏳ Agendada</option>
                        <option value="realizada">✅ Realizada</option>
                        <option value="cancelada">🚫 Cancelada</option>
                      </select>
                    </div>
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

      {/* ================= MODAL GLOBAL DE ROTINAS / LEMBRETES ================= */}
      {abrirModalLembrete && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ marginTop: 0 }}>{lembreteForm.id ? 'Editar Rotina' : 'Nova Rotina / Lembrete'}</h3>
            <form onSubmit={salvarLembreteGlobal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div>
                <label style={miniLabelStyle}>Título da Rotina</label>
                <input required style={inputEditableStyle} value={lembreteForm.titulo} onChange={e => setLembreteForm({...lembreteForm, titulo: e.target.value})} placeholder="Ex: Faturar NFs do Mês" />
              </div>
              
              {/* BUSCA DE CLIENTES (MULTI-SELECT) */}
              <div style={{ backgroundColor: '#fdfdfd', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
                <label style={miniLabelStyle}>Clientes Vinculados (Opcional)</label>
                <p style={{ fontSize: '11px', color: '#666', marginTop: 0, marginBottom: '8px' }}>Deixe vazio se for uma rotina administrativa geral da A. Corrêa.</p>
                
                {/* Lista de Clientes Selecionados */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                  {lembreteForm.clientes_ids.map(id => {
                    const cli = clientes.find(c => c.id === id);
                    return cli ? (
                      <span key={id} style={{ ...tagEditStyle, backgroundColor: '#e2e8f0' }}>
                        🏢 {cli.nome}
                        <button type="button" onClick={() => setLembreteForm(prev => ({...prev, clientes_ids: prev.clientes_ids.filter(cid => cid !== id)}))} style={tagCloseBtn}>×</button>
                      </span>
                    ) : null;
                  })}
                </div>

                {/* Input de Busca */}
                <input 
                  type="text" 
                  placeholder="🔍 Digite para buscar condomínio..." 
                  style={{ ...inputEditableStyle, marginBottom: '5px' }} 
                  value={buscaCliente} 
                  onChange={e => setBuscaCliente(e.target.value)} 
                />
                
                {/* Sugestões de Busca */}
                {clientesSugeridos.length > 0 && (
                  <div style={{ border: '1px solid #007bff', borderRadius: '4px', overflow: 'hidden' }}>
                    {clientesSugeridos.map(c => (
                      <div 
                        key={c.id} 
                        style={{ padding: '8px 10px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #eee', backgroundColor: 'white' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f8ff'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        onClick={() => {
                          setLembreteForm(prev => ({ ...prev, clientes_ids: [...prev.clientes_ids, c.id] }));
                          setBuscaCliente('');
                        }}
                      >
                        + Adicionar {c.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RESPONSÁVEIS */}
              <div>
                <label style={miniLabelStyle}>Responsáveis pela Rotina</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '5px' }}>
                  {lembreteForm.responsaveis_ids.map(id => {
                    const prof = profissionais.find(p => p.id === id);
                    return prof ? (
                      <span key={id} style={{ ...tagEditStyle, backgroundColor: '#d1e7dd' }}>
                        👤 {prof.nome_razao_social}
                        <button type="button" onClick={() => setLembreteForm(prev => ({...prev, responsaveis_ids: prev.responsaveis_ids.filter(pid => pid !== id)}))} style={tagCloseBtn}>×</button>
                      </span>
                    ) : null;
                  })}
                </div>
                <select style={inputEditableStyle} value="" onChange={(e) => {
                  if(e.target.value) setLembreteForm(prev => ({...prev, responsaveis_ids: [...prev.responsaveis_ids, e.target.value]}))
                }}>
                  <option value="">+ Adicionar Responsável...</option>
                  {profissionais.filter(p => !lembreteForm.responsaveis_ids.includes(p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.nome_razao_social}</option>
                  ))}
                </select>
              </div>

              <div style={formGridStyle}>
                <div>
                  <label style={miniLabelStyle}>Data Limite / Agendamento</label>
                  <input type="datetime-local" style={inputEditableStyle} value={lembreteForm.data_lembrete} onChange={e => setLembreteForm({...lembreteForm, data_lembrete: e.target.value})} />
                </div>
                <div>
                  <label style={miniLabelStyle}>Prioridade</label>
                  <select style={inputEditableStyle} value={lembreteForm.prioridade} onChange={e => setLembreteForm({...lembreteForm, prioridade: e.target.value})}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={miniLabelStyle}>Detalhes (Opcional)</label>
                <textarea rows={2} style={inputEditableStyle} value={lembreteForm.descricao} onChange={e => setLembreteForm({...lembreteForm, descricao: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" onClick={() => setAbrirModalLembrete(false)} style={btnBackStyle}>Cancelar</button>
                <button type="submit" style={btnGreenStyle}>Salvar Rotina</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// ESTILOS
const headerStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const statsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '15px' };
const mainColumnsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '25px', marginTop: '25px' };
const statCard: React.CSSProperties = { backgroundColor: 'white', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.3s' };
const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#444', fontWeight: 'bold', letterSpacing: '0.5px' };
const valueStyle: React.CSSProperties = { margin: '5px 0 0 0', fontSize: '22px', color: '#1a3353' };
const panelStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' };
const panelTitle: React.CSSProperties = { borderBottom: '2px solid #f0f2f5', paddingBottom: '12px', marginTop: 0, color: '#1a3353', fontSize: '17px' };
const listItem: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #f2f2f2', fontSize: '13px', cursor: 'pointer' };
const listItemLembrete: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f2f2f2' };
const clientNameLinkStyle: React.CSSProperties = { fontWeight: 500, color: '#007bff', flex: 1 };
const btnConcluirStyle: React.CSSProperties = { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' };
const badgeStyle: React.CSSProperties = { backgroundColor: '#e7f3ff', color: '#007bff', padding: '4px 12px', borderRadius: '15px', fontSize: '10px', fontWeight: 'bold' };
const btnLimparFiltro: React.CSSProperties = { padding: '5px 12px', borderRadius: '4px', border: '1px solid #d9534f', color: '#d9534f', background: 'white', cursor: 'pointer', fontSize: '12px' };
const selectStatusStyle: React.CSSProperties = { padding: '4px', borderRadius: '4px', fontSize: '11px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', cursor: 'pointer' };
const tagVisualStyle: React.CSSProperties = { backgroundColor: '#e7f3ff', color: '#007bff', padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold' };
const btnGreenStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as 'bold' };
const btnSmallStyle = { padding: '4px 8px', fontSize: '11px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' };

// Estilos do Modal
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '550px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const miniLabelStyle: React.CSSProperties = { fontSize: '11px', color: '#555', textTransform: 'uppercase', display: 'block', marginBottom: '2px', fontWeight: 'bold' };
const inputEditableStyle: React.CSSProperties = { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', fontSize: '14px', boxSizing: 'border-box' };
const formGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const btnBackStyle: React.CSSProperties = { padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' };
const tagEditStyle: React.CSSProperties = { color: '#1a202c', padding: '4px 8px', borderRadius: '15px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' };
const tagCloseBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#718096', cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1 };