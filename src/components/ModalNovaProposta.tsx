import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ModalProps {
  cliente: any;
  onClose: () => void;
}

const TIPOS_PROPOSTA = [
  "Proposta Assessoria AVCB e Laudos",
  "Proposta Adequações: Sinalização de Emergência",
  "Proposta Adequações: Central de Alarme",
  "Proposta Adequações: Iluminação de Emergência",
  "Proposta Adequações: Bomba de Incêndio"
];

// Tipagem para os itens da tabela
interface ItemSinalizacao {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
}

export function ModalNovaProposta({ cliente, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PROPOSTA[0]);
  
  // Estado para proposta de Assessoria
  const [precos, setPrecos] = useState<any>({});
  
  // Estado para proposta de Sinalização
  const [itensSinalizacao, setItensSinalizacao] = useState<ItemSinalizacao[]>([]);

  useEffect(() => {
    async function carregarPrecos() {
      // Busca a tabela inteira (não filtra mais só por categoria)
      const { data } = await supabase.from('tabela_precos').select('*').order('item_nome');
      
      if (data) {
        // 1. Mapeamento dos Serviços de Assessoria
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
          if (de_para[item.item_nome]) mapaServicos[de_para[item.item_nome]] = Number(item.preco_venda);
        });
        setPrecos(mapaServicos);

        // 2. Mapeamento das Sinalizações (Placas)
        const sinalizacoes = data
          .filter(item => item.categoria === 'Sinalização')
          .map(item => ({
            id: item.id,
            nome: item.item_nome,
            preco: Number(item.preco_venda),
            quantidade: 0 // Inicia com quantidade zero
          }));
        setItensSinalizacao(sinalizacoes);
      }
    }
    carregarPrecos();
  }, []);

  // Calcula o total com base no Tipo de Proposta Ativa
  const calcularTotal = () => {
    if (tipoSelecionado === "Proposta Assessoria AVCB e Laudos") {
      return Object.values(precos).reduce((a: number, b: any) => a + Number(b), 0) as number;
    } else if (tipoSelecionado === "Proposta Adequações: Sinalização de Emergência") {
      return itensSinalizacao.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    }
    // Para as outras que ainda não têm tela específica, total = 0
    return 0;
  };

  const handleUpdateSinalizacao = (index: number, campo: 'preco' | 'quantidade', valor: number) => {
    const novosItens = [...itensSinalizacao];
    novosItens[index][campo] = valor;
    setItensSinalizacao(novosItens);
  };

  const salvarEGerar = async () => {
    setGerando(true);
    const valorTotal = calcularTotal();
    try {
      // Salva na tabela com o título dinâmico e o valor correspondente
      const { error } = await supabase.from('orcamentos').insert({
        cliente_id: cliente.id,
        titulo: tipoSelecionado, 
        valor: valorTotal,
        data_envio: new Date().toISOString().split('T')[0],
        situacao_orcamento: 'Aguardando',
        validade_dias: 20,
        prazo_execucao_dias_uteis: 10,
        condicoes_pagamento: 'A COMBINAR'
      });

      if (error) throw error;

      // Dispara o gerador de Word
      // Provisoriamente usa o mesmo worker, injetando o título da proposta
      const dadosExport = {
        nome_cliente: cliente.nome,
        cnpj_cliente: cliente.cnpj_cpf,
        endereco_cliente: cliente.endereco,
        titulo_proposta: tipoSelecionado, 
        ...precos, // Passa os preços base para o modelo antigo não "quebrar" com chaves vazias
        preco_total: valorTotal
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

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>📝 Gerar Nova Proposta Comercial</h3>
        
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
            Selecione o Tipo de Proposta:
          </label>
          <select 
            value={tipoSelecionado} 
            onChange={(e) => setTipoSelecionado(e.target.value)}
            disabled={gerando}
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
          >
            {TIPOS_PROPOSTA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
          <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: '#888' }}>
            * Provisoriamente, todas as opções utilizarão o modelo Word base de Assessoria.
          </span>
        </div>

        {/* CONTEÚDO DINÂMICO CONFORME O TIPO */}
        <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '10px' }}>
          
          {/* TELA: ASSESSORIA E LAUDOS */}
          {tipoSelecionado === "Proposta Assessoria AVCB e Laudos" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(precos).map(key => (
                <div key={key}>
                  <label style={{ fontSize: '11px', color: '#555' }}>{key.replace('preco_', '').replace(/_/g, ' ').toUpperCase()}</label>
                  <input 
                    type="number" 
                    disabled={gerando}
                    style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} 
                    value={precos[key]} 
                    onChange={e => setPrecos({...precos, [key]: Number(e.target.value)})}
                  />
                </div>
              ))}
            </div>
          )}

          {/* TELA: SINALIZAÇÃO DE EMERGÊNCIA */}
          {tipoSelecionado === "Proposta Adequações: Sinalização de Emergência" && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#f0f0f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>Item / Placa</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '80px' }}>Preço (R$)</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '60px' }}>Qtd</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', width: '80px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {itensSinalizacao.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 0' }}>{item.nome}</td>
                    <td style={{ padding: '4px' }}>
                      <input 
                        type="number" 
                        step="0.10"
                        disabled={gerando}
                        value={item.preco} 
                        onChange={(e) => handleUpdateSinalizacao(index, 'preco', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={{ padding: '4px' }}>
                      <input 
                        type="number" 
                        min="0"
                        disabled={gerando}
                        value={item.quantidade} 
                        onChange={(e) => handleUpdateSinalizacao(index, 'quantidade', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 'bold' }}>
                      R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TELA: OUTRAS (AINDA SEM INTERFACE ESPECÍFICA) */}
          {tipoSelecionado !== "Proposta Assessoria AVCB e Laudos" && tipoSelecionado !== "Proposta Adequações: Sinalização de Emergência" && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
              <p>🚧 Interface de precificação em construção para este modelo de proposta.</p>
              <p style={{ fontSize: '11px' }}>O valor será registrado como R$ 0,00.</p>
            </div>
          )}

        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#1a3353' }}>
          TOTAL: R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={gerando} style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: 'white' }}>Cancelar</button>
          <button onClick={salvarEGerar} disabled={gerando} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {gerando ? '⏳ Processando...' : '💾 Salvar e Gerar Word'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };