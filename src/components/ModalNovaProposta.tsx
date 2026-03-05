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

export function ModalNovaProposta({ cliente, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PROPOSTA[0]);
  const [precos, setPrecos] = useState<any>({});

  // Carrega os preços (mantido para o modelo provisório)
  useEffect(() => {
    async function carregarPrecos() {
      const { data } = await supabase.from('tabela_precos').select('*').eq('categoria', 'Serviços');
      if (data) {
        const mapa: any = {};
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
          if (de_para[item.item_nome]) mapa[de_para[item.item_nome]] = Number(item.preco_venda);
        });
        setPrecos(mapa);
      }
    }
    carregarPrecos();
  }, []);

const calcularTotal = () => Object.values(precos).reduce((a: number, b: any) => a + Number(b), 0);
  const salvarEGerar = async () => {
    setGerando(true);
    const valorTotal = calcularTotal();
    try {
      // Salva na tabela com o título dinâmico
      const { error } = await supabase.from('orcamentos').insert({
        cliente_id: cliente.id,
        titulo: tipoSelecionado, // <- AQUI ESTÁ O NOVO CAMPO
        valor: valorTotal,
        data_envio: new Date().toISOString().split('T')[0],
        situacao_orcamento: 'Aguardando',
        validade_dias: 20,
        prazo_execucao_dias_uteis: 10,
        condicoes_pagamento: 'A COMBINAR'
      });

      if (error) throw error;

      // Dispara o gerador de Word (Provisoriamente usa o mesmo worker)
      const dadosExport = {
        nome_cliente: cliente.nome,
        cnpj_cliente: cliente.cnpj_cpf,
        endereco_cliente: cliente.endereco,
        titulo_proposta: tipoSelecionado, // Injetado caso queira colocar a tag {titulo_proposta} no Word
        ...precos,
        preco_total: valorTotal
      };

      // @ts-ignore
      await window.acorreaAPI.gerarPropostaAssessoriaLaudos(dadosExport);

      setGerando(false); // Libera estado
      onClose(); // Fecha após gerar sem travar com alert
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
            * Provisoriamente, todas as opções utilizarão o modelo base de Assessoria.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '10px' }}>
          {Object.keys(precos).map(key => (
            <div key={key}>
              <label style={{ fontSize: '11px', color: '#555' }}>{key.replace('preco_', '').replace(/_/g, ' ').toUpperCase()}</label>
              <input 
                type="number" 
                disabled={gerando}
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} 
                value={precos[key]} 
                onChange={e => setPrecos({...precos, [key]: Number(e.target.value)})}
              />
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#1a3353' }}>
          TOTAL: R$ {calcularTotal().toLocaleString('pt-BR')}
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
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };