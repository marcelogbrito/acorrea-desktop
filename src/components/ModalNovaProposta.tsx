//src\components\ModalNovaProposta.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ModalProps {
  cliente: any;
  orcamentoEditando?: any; // Recebe o orçamento para edição
  onClose: () => void;
}

const TIPOS_PROPOSTA = [
  "Proposta Assessoria AVCB e Laudos",
  "Proposta Adequações: Sinalização de Emergência",
  "Proposta Adequações: Central de Alarme",
  "Proposta Adequações: Registro de Recalque",
  "Proposta Adequações: Iluminação de Emergência",
  "Proposta Adequações: Bomba de Incêndio"
];

interface CategoriaItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  unidade: string;
}

export function ModalNovaProposta({ cliente, orcamentoEditando, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PROPOSTA[0]);
  
  const [precos, setPrecos] = useState<any>({});
  const [itensSinalizacao, setItensSinalizacao] = useState<CategoriaItem[]>([]);
  const [itensAlarme, setItensAlarme] = useState<CategoriaItem[]>([]);
  const [itensRecalque, setItensRecalque] = useState<CategoriaItem[]>([]);
  const [itensIluminacao, setItensIluminacao] = useState<CategoriaItem[]>([]);
  const [itensBomba, setItensBomba] = useState<CategoriaItem[]>([]);

  useEffect(() => {
    if (orcamentoEditando && orcamentoEditando.titulo) {
      setTipoSelecionado(orcamentoEditando.titulo);
    }

    async function carregarPrecos() {
      const { data } = await supabase.from('tabela_precos').select('*').order('item_nome');
      
      // Se estiver editando, busca o JSON salvo. Se for novo, usa um objeto vazio.
      const jsonSalvo = orcamentoEditando?.dados_json || {};

      if (data) {
        // 1. Mapeamento dos Serviços Estáticos (Assessoria)
        const mapaServicos: any = {};
        const de_para: any = {
          'Assessoria obtenção de AVCB': 'preco_assessoria_avcb',
          'Atestado Sist. Proteção contra Incêndio': 'preco_sistema_incendio',
          'Treinamento Brigada de Incêndio': 'preco_brigada',
          'Atestado do Sistema de Gás': 'preco_atestado_gas',
          'Atestado Sistema de Alarme': 'preco_atestado_alarme',
          'Atestado Pressurização de Escadas': 'preco_atestado_pressurizacao',
          'Atestado Instalações Elétricas': 'preco_atestado_eletrica',
          'Atestado CMAR (Acabamento e Revestimento)': 'preco_atestado_cmar',
          'Atestado Sistema de Hidrantes': 'preco_sistema_hidrantes',
          'Atestado Compartimentação (Shafts/Fachada)': 'preco_atestado_shafts',
          'Atestado do Gerador': 'preco_atestado_gerador'
        };
        data.forEach(item => {
          if (de_para[item.item_nome]) {
             const key = de_para[item.item_nome];
             // Prioriza o valor salvo no JSON do orçamento. Se não existir, pega o atual da tabela de preços
             mapaServicos[key] = jsonSalvo.precos && jsonSalvo.precos[key] !== undefined 
                ? jsonSalvo.precos[key] 
                : Number(item.preco_venda);
          }
        });
        setPrecos(mapaServicos);

        // 2. Mapeamento das Categorias Dinâmicas
        const mapearCategoria = (categoriaNome: string, jsonKey: string) => data
          .filter(item => item.categoria === categoriaNome)
          .map(item => {
            // Busca se o item já tem quantidade e preço salvos no JSON deste orçamento
            const itemSalvo = jsonSalvo[jsonKey]?.find((i: any) => i.id === item.id);
            return {
              id: item.id,
              nome: item.item_nome,
              preco: itemSalvo ? Number(itemSalvo.preco) : Number(item.preco_venda),
              quantidade: itemSalvo ? Number(itemSalvo.quantidade) : 0,
              unidade: item.unidade_medida || 'un'
            }
          });

        setItensSinalizacao(mapearCategoria('Sinalização', 'itensSinalizacao'));
        setItensAlarme(mapearCategoria('Central de Alarme', 'itensAlarme'));
        setItensRecalque(mapearCategoria('Registro de Recalque', 'itensRecalque'));
        setItensIluminacao(mapearCategoria('Iluminação de Emergência', 'itensIluminacao'));
        setItensBomba(mapearCategoria('Bomba de Incêndio', 'itensBomba'));
      }
    }
    carregarPrecos();
  }, [orcamentoEditando]);

  const calcularTotal = () => {
    if (tipoSelecionado === "Proposta Assessoria AVCB e Laudos") {
      return Object.values(precos).reduce((a: number, b: any) => a + Number(b), 0) as number;
    } else if (tipoSelecionado === "Proposta Adequações: Sinalização de Emergência") {
      return itensSinalizacao.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    } else if (tipoSelecionado === "Proposta Adequações: Central de Alarme") {
      return itensAlarme.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    } else if (tipoSelecionado === "Proposta Adequações: Registro de Recalque") {
      return itensRecalque.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    } else if (tipoSelecionado === "Proposta Adequações: Iluminação de Emergência") {
      return itensIluminacao.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    } else if (tipoSelecionado === "Proposta Adequações: Bomba de Incêndio") {
      return itensBomba.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    }
    return 0;
  };

  const formatarItensParaWord = (itens: CategoriaItem[]) => {
    const selecionados = itens.filter(i => i.quantidade > 0);
    if (selecionados.length === 0) return "Nenhum item adicionado à proposta.";
    
    return selecionados.map(i => {
      const totalFormatado = (i.quantidade * i.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `• ${String(i.quantidade).padStart(2, '0')} ${i.unidade} - ${i.nome} - Total: ${totalFormatado}`;
    }).join('\n');
  };

  const salvarEGerar = async () => {
    setGerando(true);
    const valorTotal = calcularTotal();

    // Cria o JSON com todos os dados da tela para salvar no banco
    const payloadJson = {
      precos,
      itensSinalizacao: itensSinalizacao.filter(i => i.quantidade > 0),
      itensAlarme: itensAlarme.filter(i => i.quantidade > 0),
      itensRecalque: itensRecalque.filter(i => i.quantidade > 0),
      itensIluminacao: itensIluminacao.filter(i => i.quantidade > 0),
      itensBomba: itensBomba.filter(i => i.quantidade > 0),
    };

    try {
      const orcamentoPayload = {
        cliente_id: cliente.id,
        titulo: tipoSelecionado, 
        valor: valorTotal,
        // Se estiver editando, preserva a data e situação originais
        data_envio: orcamentoEditando ? orcamentoEditando.data_envio : new Date().toISOString().split('T')[0],
        situacao_orcamento: orcamentoEditando ? orcamentoEditando.situacao_orcamento : 'Aguardando',
        validade_dias: 20,
        prazo_execucao_dias_uteis: 10,
        condicoes_pagamento: 'A COMBINAR',
        dados_json: payloadJson // <- Salva a fotografia do momento!
      };

      // Atualiza ou Insere dependendo do contexto
      if (orcamentoEditando) {
        const { error } = await supabase.from('orcamentos').update(orcamentoPayload).eq('id', orcamentoEditando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('orcamentos').insert([orcamentoPayload]);
        if (error) throw error;
      }

      // Prepara os dados para gerar o arquivo Word
      const dadosExport = {
        nome_cliente: cliente.nome,
        cnpj_cliente: cliente.cnpj_cpf,
        endereco_cliente: cliente.endereco,
        titulo_proposta: tipoSelecionado, 
        preco_total: valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        ...precos, 
        
        itens_sinalizacao: formatarItensParaWord(itensSinalizacao),
        itens_alarme: formatarItensParaWord(itensAlarme),
        itens_recalque: formatarItensParaWord(itensRecalque),
        itens_iluminacao: formatarItensParaWord(itensIluminacao),
        itens_bomba: formatarItensParaWord(itensBomba),
      };

      // @ts-ignore
      await window.acorreaAPI.gerarPropostaAssessoriaLaudos(dadosExport);

      setGerando(false);
      onClose(); 
    } catch (err: any) {
      setGerando(false);
      alert("Erro: " + err.message);
    }
  };

  const renderTabelaItens = (itens: CategoriaItem[], setItens: React.Dispatch<React.SetStateAction<CategoriaItem[]>>) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead style={{ backgroundColor: '#f0f0f0', textAlign: 'left' }}>
        <tr>
          <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Item / Serviço</th>
          <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '80px' }}>Preço (R$)</th>
          <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '60px' }}>Qtd</th>
          <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '80px', textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((item, index) => (
          <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '8px 0' }}>{item.nome}</td>
            <td style={{ padding: '4px' }}>
              <input 
                type="number" step="0.10" disabled={gerando} value={item.preco} 
                onChange={(e) => {
                  const novos = [...itens];
                  novos[index].preco = Number(e.target.value);
                  setItens(novos);
                }}
                style={{ width: '100%', padding: '4px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} 
              />
            </td>
            <td style={{ padding: '4px' }}>
              <input 
                type="number" min="0" disabled={gerando} value={item.quantidade} 
                onChange={(e) => {
                  const novos = [...itens];
                  novos[index].quantidade = Number(e.target.value);
                  setItens(novos);
                }}
                style={{ width: '100%', padding: '4px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} 
              />
            </td>
            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold', color: item.quantidade > 0 ? '#28a745' : '#333' }}>
              R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>{orcamentoEditando ? '✏️ Editar Proposta Comercial' : '📝 Gerar Nova Proposta Comercial'}</h3>
        
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
            Selecione o Tipo de Proposta:
          </label>
          <select 
            value={tipoSelecionado} 
            onChange={(e) => setTipoSelecionado(e.target.value)}
            disabled={gerando || !!orcamentoEditando} // Bloqueia troca de tipo se estiver editando
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', opacity: orcamentoEditando ? 0.7 : 1 }}
          >
            {TIPOS_PROPOSTA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        </div>

        <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '10px' }}>
          
          {tipoSelecionado === "Proposta Assessoria AVCB e Laudos" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(precos).map(key => (
                <div key={key}>
                  <label style={{ fontSize: '11px', color: '#555' }}>{key.replace('preco_', '').replace(/_/g, ' ').toUpperCase()}</label>
                  <input 
                    type="number" disabled={gerando}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} 
                    value={precos[key]} 
                    onChange={e => setPrecos({...precos, [key]: Number(e.target.value)})}
                  />
                </div>
              ))}
            </div>
          )}

          {tipoSelecionado === "Proposta Adequações: Sinalização de Emergência" && renderTabelaItens(itensSinalizacao, setItensSinalizacao)}
          {tipoSelecionado === "Proposta Adequações: Central de Alarme" && renderTabelaItens(itensAlarme, setItensAlarme)}
          {tipoSelecionado === "Proposta Adequações: Registro de Recalque" && renderTabelaItens(itensRecalque, setItensRecalque)}
          {tipoSelecionado === "Proposta Adequações: Iluminação de Emergência" && renderTabelaItens(itensIluminacao, setItensIluminacao)}
          {tipoSelecionado === "Proposta Adequações: Bomba de Incêndio" && renderTabelaItens(itensBomba, setItensBomba)}

        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#1a3353' }}>
          TOTAL DA PROPOSTA: R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={gerando} style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: 'white' }}>Cancelar</button>
          <button onClick={salvarEGerar} disabled={gerando} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {gerando ? '⏳ Processando...' : (orcamentoEditando ? '💾 Atualizar e Gerar Word' : '💾 Salvar e Gerar Word')}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };