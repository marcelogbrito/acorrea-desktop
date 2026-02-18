import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GerenciamentoProjetosProps {
  clienteId: string;
  clienteNome: string;
}

export function GerenciamentoProjetos({ clienteId, clienteNome }: GerenciamentoProjetosProps) {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  
  // Estados para o novo vínculo de DWG
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [novoProjeto, setNovoProjeto] = useState({ titulo: '', file_path_dwg: '' });

  useEffect(() => {
    fetchProjetos();
    carregarItensGlobais();
  }, [clienteId]);

  async function fetchProjetos() {
    const { data } = await supabase
      .from('projetos_ppci')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('updated_at', { ascending: false });
    setProjetos(data || []);
  }

  async function carregarItensGlobais() {
    const { data } = await supabase.from('tabela_precos').select('*').order('categoria');
    if (data) {
      const itensFormatados = data.map(item => ({
        tipo: item.item_nome,
        cor: item.cor_autocad,
        quantidade: 0, 
        preco_unitario: item.preco_venda
      }));
      setEquipamentos(itensFormatados);
    }
  }

  // Função para selecionar arquivo DWG usando a API do Electron
  const selecionarArquivoDWG = async () => {
    try {
      // @ts-ignore
      const caminho = await window.acorreaAPI.selecionarArquivo({
        title: 'Selecionar Projeto AutoCAD',
        extensions: ['dwg']
      });
      if (caminho) {
        setNovoProjeto({ ...novoProjeto, file_path_dwg: caminho });
      }
    } catch (err) {
      console.error("Erro ao selecionar arquivo:", err);
    }
  };

  const salvarNovoProjeto = async () => {
  if (!novoProjeto.titulo || !novoProjeto.file_path_dwg) {
    alert("Preencha o título e selecione o arquivo DWG.");
    return;
  }
  
  setLoading(true);
  const { error } = await supabase
    .from('projetos_ppci')
    .insert({
      cliente_id: clienteId,
      titulo: novoProjeto.titulo,
      file_path_dwg: novoProjeto.file_path_dwg,
      status: 'rascunho', // MUDANÇA AQUI: Alterado de 'Pendente' para 'rascunho'
      versao: '1.0'
    });

    if (!error) {
      setMostrandoForm(false);
      setNovoProjeto({ titulo: '', file_path_dwg: '' });
      fetchProjetos();
    } else {
      alert("Erro ao salvar projeto: " + error.message);
    }
    setLoading(false);
  };

  const dispararAutomacaoPython = async (projeto: any) => {
    try {
      setLoading(true);
      // @ts-ignore
      const resultado = await window.acorreaAPI.executarPyCad({
        projetoId: projeto.id,
        dwgPath: projeto.file_path_dwg,
        dadosEquipamentos: { itens: equipamentos.filter(e => e.quantidade > 0) }
      });

      if (resultado.success) {
        const { error } = await supabase
          .from('projetos_ppci')
          .update({ 
            inventario_equipamentos: equipamentos.filter(e => e.quantidade > 0),
            ultima_automacao: new Date().toISOString(),
            status: 'Desenho Gerado'
          })
          .eq('id', projeto.id);

        if (error) throw error;
        alert('Automação concluída! AutoCAD desenhado e inventário sincronizado.');
        fetchProjetos();
      }
    } catch (err: any) {
      alert('Erro na automação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const gerarPDFProposta = () => {
    const doc = new jsPDF();
    const itensFiltrados = equipamentos.filter(e => e.quantidade > 0);
    if (itensFiltrados.length === 0) return alert("Adicione quantidades primeiro.");

    doc.setFillColor(26, 51, 83); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("ACORREA GESTÃO", 15, 25);

    doc.setTextColor(0, 0, 0);
    doc.text(`PROPOSTA COMERCIAL: ${clienteNome}`, 15, 55);

    autoTable(doc, {
      startY: 70,
      head: [["Equipamento", "Qtd", "Unitário", "Subtotal"]],
      body: itensFiltrados.map(e => [e.tipo, e.quantidade, `R$ ${e.preco_unitario.toLocaleString('pt-BR')}`, `R$ ${(e.quantidade * e.preco_unitario).toLocaleString('pt-BR')}`]),
      headStyles: { fillColor: [26, 51, 83] }
    });

    doc.save(`Proposta_${clienteNome.replace(/\s/g, '_')}.pdf`);
  };

  // Adicione esta função para abrir o PDF localmente via Electron
const abrirPDFLocal = async (caminhoDWG: string) => {
  // Converte .dwg para .pdf no caminho string
  const caminhoPDF = caminhoDWG.toLowerCase().replace('.dwg', '.pdf');
  
  try {
    // @ts-ignore
    await window.acorreaAPI.abrirArquivoLocal(caminhoPDF);
  } catch (err) {
    alert("O PDF pode ainda estar sendo gerado pelo AutoCAD. Aguarde 5 segundos e tente novamente.");
  }
};

const excluirProjeto = async (id: string) => {
  if (!window.confirm("Deseja realmente remover este vínculo de projeto?")) return;

  const { error } = await supabase
    .from('projetos_ppci')
    .delete()
    .eq('id', id);

  if (!error) {
    // Atualiza a lista local removendo o projeto excluído
    setProjetos(projetos.filter(p => p.id !== id));
  } else {
    alert("Erro ao excluir: " + error.message);
  }
};

  const totalOrcamento = equipamentos.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>📐 Engenharia: Automação PPCI</h3>
            <button 
              onClick={() => setMostrandoForm(!mostrandoForm)} 
              style={mostrandoForm ? btnCancelStyle : btnNovoProjetoStyle}
            >
              {mostrandoForm ? 'Cancelar' : '+ Vincular DWG'}
            </button>
          </div>

          {mostrandoForm && (
            <div style={miniFormStyle}>
              <input 
                placeholder="Título do Projeto (Ex: Planta Térreo)" 
                style={inputStyle} 
                value={novoProjeto.titulo}
                onChange={e => setNovoProjeto({...novoProjeto, titulo: e.target.value})}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  placeholder="Caminho do arquivo .dwg" 
                  style={{ ...inputStyle, flex: 1 }} 
                  readOnly
                  value={novoProjeto.file_path_dwg}
                />
                <button onClick={selecionarArquivoDWG} style={btnSearchStyle}>Buscar no PC 📂</button>
              </div>
              <button onClick={salvarNovoProjeto} disabled={loading} style={btnSaveStyle}>
                {loading ? 'Salvando...' : 'Confirmar Vínculo'}
              </button>
            </div>
          )}

          <div style={simuladorBoxStyle}>
            <h4 style={{ marginTop: 0 }}>⚡ Editor de Equipamentos (Sincronizado com AutoCAD)</h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {equipamentos.map((eq, idx) => (
                <div key={idx} style={itemEditorStyle}>
                    <span style={{ flex: 1, fontSize: '13px' }}>{eq.tipo}</span>
                    <input type="number" min="0" value={eq.quantidade} style={numInputStyle}
                      onChange={(e) => {
                          const newEqs = [...equipamentos];
                          newEqs[idx].quantidade = parseInt(e.target.value) || 0;
                          setEquipamentos(newEqs);
                      }}
                    />
                </div>
                ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            {projetos.map(p => (
              <div key={p.id} style={projetoCardStyle}>
                <div style={{ flex: 1 }}>
                  <strong>{p.titulo}</strong>
                  <div style={{ fontSize: '11px', color: '#666' }}>Arquivo: {p.file_path_dwg} Status:{p.file_path_dwg} {p.status}</div>
                </div>
               {/* Botão de visualizar PDF (aparece se o status for Desenho Gerado) */}
      {p.status === 'Desenho Gerado' && (
        <button 
  onClick={() => abrirPDFLocal(p.file_path_dwg)}
  style={{ ...btnIconStyle, backgroundColor: '#34495e', color: 'white', border: 'none' }}
>
  👁️ Ver Planta PDF
</button>
      )}

      <button 
        onClick={() => dispararAutomacaoPython(p)}
        disabled={loading}
        style={p.status === 'Desenho Gerado' ? btnSuccessStyle : btnRunStyle}
      >
        {loading ? 'Processando...' : p.status === 'Desenho Gerado' ? '🔄 Atualizar CAD' : '⚡ Rodar PyCAD'}
      </button>

      <button 
        onClick={() => excluirProjeto(p.id)}
        style={btnDeleteStyle}
        title="Excluir vínculo"
      >
        🗑️
      </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside style={panelStyle}>
        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>💰 Orçamento Estimado</h3>
        <div style={{ margin: '15px 0', maxHeight: '400px', overflowY: 'auto' }}>
          {equipamentos.filter(e => e.quantidade > 0).map((eq, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
              <span>{eq.quantidade}x {eq.tipo}</span>
              <strong>R$ {(eq.quantidade * eq.preco_unitario).toLocaleString('pt-BR')}</strong>
            </div>
          ))}
        </div>
        <div style={totalBoxStyle}>
          <span>Total:</span>
          <strong>R$ {totalOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
        </div>
        <button onClick={gerarPDFProposta} style={btnOrcamentoStyle}>Gerar Proposta PDF 📄</button>
      </aside>
    </div>
  );
}

// ESTILOS
const panelStyle = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' };
const simuladorBoxStyle = { backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e9ecef' };
const miniFormStyle = { display: 'flex', flexDirection: 'column' as 'column', gap: '10px', padding: '15px', backgroundColor: '#eef2f7', borderRadius: '8px', marginBottom: '20px' };
const itemEditorStyle = { display: 'flex', alignItems: 'center', marginBottom: '5px', padding: '5px', borderBottom: '1px solid #eee' };
const numInputStyle = { width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' as 'center' };
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' };
const totalBoxStyle = { borderTop: '2px solid #1a3353', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', color: '#1a3353', fontSize: '16px' };
const btnRunStyle = { backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const btnSuccessStyle = { backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const btnOrcamentoStyle = { width: '100%', marginTop: '15px', padding: '12px', backgroundColor: '#1a3353', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const projetoCardStyle = { display: 'flex', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '8px' };
const btnNovoProjetoStyle = { backgroundColor: '#1a3353', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' };
const btnCancelStyle = { backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' };
const btnSaveStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const btnSearchStyle = { backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '0 15px', borderRadius: '4px', cursor: 'pointer' };
const btnIconStyle = { 
  padding: '8px 12px', 
  fontSize: '12px', 
  borderRadius: '4px', 
  cursor: 'pointer', 
  border: '1px solid #ccc', 
  fontWeight: '600' as '600',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  transition: 'all 0.2s'
};
const btnDeleteStyle = {
  backgroundColor: 'transparent',
  border: '1px solid #ff4d4f',
  color: '#ff4d4f',
  padding: '5px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  marginLeft: '10px'
};