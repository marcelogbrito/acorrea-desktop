import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ModalProps {
  cliente: any;
  onClose: () => void;
}

export function ModalPropostaAssessoriaLaudos({ cliente, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  
  // Estado para armazenar os preços numéricos editáveis
  const [precos, setPrecos] = useState({
    preco_assessoria_avcb: 0,
    preco_sistema_incendio: 0,
    preco_brigada: 0,
    preco_atestado_gas: 0,
    preco_atestado_alarme: 0,
    preco_atestado_pressurizacao: 0,
    preco_atestado_eletrica: 0,
    preco_atestado_cmar: 0,
    preco_sistema_hidrantes: 0,
    preco_atestado_shafts: 0,
    preco_atestado_gerador: 0,
  });

  useEffect(() => {
    async function carregarPrecosPadrao() {
      const { data } = await supabase.from('tabela_precos').select('*').eq('categoria', 'Serviços');
      if (!data) return;

      // Mapeia o nome do banco de dados para a chave do estado
      const mapaNomes: any = {
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
        'Atestado do Gerador': 'preco_atestado_gerador',
      };

      const precosIniciais = { ...precos };
      data.forEach(item => {
        const chave = mapaNomes[item.item_nome];
        if (chave) precosIniciais[chave as keyof typeof precos] = Number(item.preco_venda);
      });

      setPrecos(precosIniciais);
    }
    carregarPrecosPadrao();
  }, []);

  const handleChange = (chave: keyof typeof precos, valorStr: string) => {
    const valorNum = Number(valorStr.replace(',', '.'));
    setPrecos({ ...precos, [chave]: isNaN(valorNum) ? 0 : valorNum });
  };

  const calcularTotal = () => Object.values(precos).reduce((acc, curr) => acc + curr, 0);

  const gerarProposta = async () => {
  setGerando(true);
  try {
    const valorTotalCalculado = calcularTotal();

    // 1. SALVAR NO BANCO DE DADOS (Ajustado para o seu schema real)
    const { error: dbError } = await supabase.from('orcamentos').insert({
      cliente_id: cliente.id,
      valor: valorTotalCalculado,
      data_envio: new Date().toISOString().split('T')[0], // data_envio é DATE (YYYY-MM-DD)
      validade_dias: 20, // Conforme PDF [cite: 104, 241]
      prazo_execucao_dias_uteis: 10, // Conforme PDF [cite: 100, 237]
      condicoes_pagamento: 'A combinar.', // Conforme PDF [cite: 91, 228]
      situacao_orcamento: 'Aguardando' // Valor padrão do seu ENUM
    });

    if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);

    // 2. PREPARAR DADOS PARA O WORD (Incluso valor por extenso e caixa alta)
    const dadosExportacao = {
      nome_cliente: String(cliente.nome).toUpperCase(),
      cnpj_cliente: cliente.cnpj_cpf,
      endereço_cliente: String(cliente.endereco).toUpperCase(),
      ...precos,
      preco_total: valorTotalCalculado
    };

    // @ts-ignore
    await window.acorreaAPI.gerarPropostaAssessoriaLaudos(dadosExportacao);
    
    alert("✅ Orçamento registrado e documento gerado!");
    onClose();
  } catch (err: any) {
    alert("Erro na operação: " + err.message);
  } finally {
    setGerando(false);
  }
};

  const formItems = [
    { label: 'Assessoria AVCB', key: 'preco_assessoria_avcb' },
    { label: 'Sistema de Incêndio', key: 'preco_sistema_incendio' },
    { label: 'Treinamento Brigada', key: 'preco_brigada' },
    { label: 'Atestado de Gás', key: 'preco_atestado_gas' },
    { label: 'Sistema de Alarme', key: 'preco_atestado_alarme' },
    { label: 'Pressurização de Escadas', key: 'preco_atestado_pressurizacao' },
    { label: 'Instalações Elétricas', key: 'preco_atestado_eletrica' },
    { label: 'Atestado CMAR', key: 'preco_atestado_cmar' },
    { label: 'Sistema de Hidrantes', key: 'preco_sistema_hidrantes' },
    { label: 'Compartimentação/Shafts', key: 'preco_atestado_shafts' },
    { label: 'Atestado do Gerador', key: 'preco_atestado_gerador' },
  ];

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>📄 Proposta: Assessoria e Laudos</h2>
        <p>Revise ou edite os valores abaixo antes de gerar o documento.</p>

        <div style={gridFormStyle}>
          {formItems.map(item => (
            <div key={item.key} style={inputGroupStyle}>
              <label style={labelStyle}>{item.label}</label>
              <div style={inputWrapperStyle}>
                <span style={currencySymbolStyle}>R$</span>
                <input 
                  type="number" step="0.01"
                  value={precos[item.key as keyof typeof precos]} 
                  onChange={(e) => handleChange(item.key as keyof typeof precos, e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={totalStyle}>
          Total: <strong>R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
        </div>

        <div style={actionsStyle}>
          <button onClick={onClose} style={btnCancelStyle}>Cancelar</button>
          <button onClick={gerarProposta} disabled={gerando} style={btnGreenStyle}>
            {gerando ? 'Gerando...' : 'Gerar Documento Word'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ESTILOS
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '700px', maxHeight: '90vh', overflowY: 'auto' };
const gridFormStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' };
const inputGroupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 'bold', color: '#555' };
const inputWrapperStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' };
const currencySymbolStyle: React.CSSProperties = { backgroundColor: '#eee', padding: '8px 12px', color: '#555', borderRight: '1px solid #ccc', fontSize: '14px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', border: 'none', outline: 'none', fontSize: '14px' };
const totalStyle: React.CSSProperties = { marginTop: '25px', textAlign: 'right', fontSize: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' };
const actionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' };
const btnCancelStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', border: '1px solid #ccc', backgroundColor: '#fff', borderRadius: '6px' };
const btnGreenStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', border: 'none', backgroundColor: '#28a745', color: '#fff', borderRadius: '6px', fontWeight: 'bold' };