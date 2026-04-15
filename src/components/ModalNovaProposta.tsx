//src\components\ModalNovaProposta.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

interface ModalProps {
  cliente: any;
  orcamentoEditando?: any; 
  onClose: () => void;
}

const TIPOS_PROPOSTA = [
  "Proposta Assessoria AVCB e Laudos",
  "Proposta Adequações: Sinalização de Emergência",
  "Proposta Adequações: Central de Alarme",
  "Proposta Adequações: Registro de Recalque",
  "Proposta Adequações: Iluminação de Emergência",
  "Proposta Adequações: Bomba de Incêndio",
  "Proposta Adequações: Extintores",
  "Proposta Adequações: Andares e Escadarias"
];

interface CategoriaItem {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  unidade: string;
}

// ==========================================
// FUNÇÕES AUXILIARES PARA GERAÇÃO WEB
// ==========================================
function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas10 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function converterGrupo(n: number): string {
    if (n === 100) return 'cem';
    let str = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (c > 0) str += centenas[c] + (d > 0 || u > 0 ? ' e ' : '');
    if (d === 1) str += dezenas10[u];
    else {
      if (d > 1) str += dezenas[d] + (u > 0 ? ' e ' : '');
      if (u > 0) str += unidades[u];
    }
    return str;
  }

  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  let resultado = '';
  
  if (reais > 0) {
    const milhares = Math.floor(reais / 1000);
    const resto = reais % 1000;
    if (milhares > 0) resultado += (milhares === 1 ? 'mil' : converterGrupo(milhares) + ' mil') + (resto > 0 ? (resto <= 100 || resto % 100 === 0 ? ' e ' : ' ') : '');
    if (resto > 0) resultado += converterGrupo(resto);
    resultado += reais === 1 ? ' real' : ' reais';
  }
  if (centavos > 0) {
    if (resultado.length > 0) resultado += ' e ';
    resultado += converterGrupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }
  return resultado;
}

const formatarMoedaSegura = (valor: any) => {
  if (valor === undefined || valor === null || valor === '') return '';
  let num = valor;
  if (typeof valor === 'string') {
     num = parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.'));
     if (isNaN(num)) return valor;
  }
  const formatado = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${formatado} (${valorPorExtenso(num)})`;
};
// ==========================================


export function ModalNovaProposta({ cliente, orcamentoEditando, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState(TIPOS_PROPOSTA[0]);
  
  const [precos, setPrecos] = useState<any>({});
  const [itensSinalizacao, setItensSinalizacao] = useState<CategoriaItem[]>([]);
  const [itensAlarme, setItensAlarme] = useState<CategoriaItem[]>([]);
  const [itensRecalque, setItensRecalque] = useState<CategoriaItem[]>([]);
  const [itensIluminacao, setItensIluminacao] = useState<CategoriaItem[]>([]);
  const [itensBomba, setItensBomba] = useState<CategoriaItem[]>([]);
  const [itensExtintores, setItensExtintores] = useState<CategoriaItem[]>([]);
  const [itensEscadaria, setItensEscadaria] = useState<CategoriaItem[]>([]); 

  useEffect(() => {
    if (orcamentoEditando && orcamentoEditando.titulo) {
      setTipoSelecionado(orcamentoEditando.titulo);
    }

    async function carregarPrecos() {
      const { data } = await supabase.from('tabela_precos').select('*').order('item_nome');
      const jsonSalvo = orcamentoEditando?.dados_json || {};

      if (data) {
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
             mapaServicos[key] = jsonSalvo.precos && jsonSalvo.precos[key] !== undefined 
                ? jsonSalvo.precos[key] 
                : Number(item.preco_venda);
          }
        });
        setPrecos(mapaServicos);

        const mapearCategoria = (categoriaNome: string, jsonKey: string) => data
          .filter(item => item.categoria === categoriaNome)
          .map(item => {
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
        setItensExtintores(mapearCategoria('Extintores', 'itensExtintores'));
        setItensEscadaria(mapearCategoria('Andares e Escadarias', 'itensEscadaria'));
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
    } else if (tipoSelecionado === "Proposta Adequações: Extintores") {
      return itensExtintores.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    } else if (tipoSelecionado === "Proposta Adequações: Andares e Escadarias") {
      return itensEscadaria.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    }
    return 0;
  };

  const getItensAtuais = (): CategoriaItem[] => {
    if (tipoSelecionado === "Proposta Adequações: Sinalização de Emergência") return itensSinalizacao;
    if (tipoSelecionado === "Proposta Adequações: Central de Alarme") return itensAlarme;
    if (tipoSelecionado === "Proposta Adequações: Registro de Recalque") return itensRecalque;
    if (tipoSelecionado === "Proposta Adequações: Iluminação de Emergência") return itensIluminacao;
    if (tipoSelecionado === "Proposta Adequações: Bomba de Incêndio") return itensBomba;
    if (tipoSelecionado === "Proposta Adequações: Extintores") return itensExtintores;
    if (tipoSelecionado === "Proposta Adequações: Andares e Escadarias") return itensEscadaria; 
    return [];
  };

  const exportarParaExcel = () => {
    const itensAtivos = getItensAtuais().filter(i => i.quantidade > 0);
    if (tipoSelecionado === "Proposta Assessoria AVCB e Laudos") {
      return alert("A exportação para Excel está disponível apenas para as propostas de adequações (listas de materiais).");
    }
    if (itensAtivos.length === 0) {
      return alert("Selecione a quantidade de pelo menos um item para exportar.");
    }
    const cabecalho = ['Item / Serviço', 'Quantidade', 'Unidade', 'Preço Unitário (R$)', 'Total (R$)'];
    const linhas = itensAtivos.map(item => [
      `"${item.nome}"`, item.quantidade, `"${item.unidade}"`,
      `"${item.preco.toFixed(2).replace('.', ',')}"`, `"${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}"`
    ]);
    linhas.push(['"TOTAL GERAL"', '', '', '', `"${calcularTotal().toFixed(2).replace('.', ',')}"`]);
    const csvContent = "\uFEFF" + [cabecalho.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const nomeArquivoSafe = tipoSelecionado.replace(/[^a-z0-9]/gi, '_');
    link.setAttribute('download', `Itens_${nomeArquivoSafe}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatarItensParaWord = (itens: CategoriaItem[]) => {
    const selecionados = itens.filter(i => i.quantidade > 0);
    if (selecionados.length === 0) return "Nenhum item adicionado à proposta.";
    return selecionados.map(i => {
      const totalFormatado = (i.quantidade * i.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `• ${String(i.quantidade).padStart(2, '0')} ${i.unidade} - ${i.nome} - Total: ${totalFormatado}`;
    }).join('\n');
  };

  const salvarNoBanco = async () => {
    const valorTotal = calcularTotal();
    const payloadJson = {
      precos,
      itensSinalizacao: itensSinalizacao.filter(i => i.quantidade > 0),
      itensAlarme: itensAlarme.filter(i => i.quantidade > 0),
      itensRecalque: itensRecalque.filter(i => i.quantidade > 0),
      itensIluminacao: itensIluminacao.filter(i => i.quantidade > 0),
      itensBomba: itensBomba.filter(i => i.quantidade > 0),
      itensExtintores: itensExtintores.filter(i => i.quantidade > 0),
      itensEscadaria: itensEscadaria.filter(i => i.quantidade > 0), 
    };

    const orcamentoPayload = {
      cliente_id: cliente.id,
      titulo: tipoSelecionado, 
      valor: valorTotal,
      data_envio: orcamentoEditando ? orcamentoEditando.data_envio : new Date().toISOString().split('T')[0],
      situacao_orcamento: orcamentoEditando ? orcamentoEditando.situacao_orcamento : 'Aguardando',
      validade_dias: 20,
      prazo_execucao_dias_uteis: 10,
      condicoes_pagamento: 'A COMBINAR',
      dados_json: payloadJson 
    };

    if (orcamentoEditando) {
      const { error } = await supabase.from('orcamentos').update(orcamentoPayload).eq('id', orcamentoEditando.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('orcamentos').insert([orcamentoPayload]);
      if (error) throw error;
    }
    return valorTotal;
  };

  const handleApenasSalvar = async () => {
    setSalvando(true);
    try {
      await salvarNoBanco();
      alert("✅ Orçamento salvo com sucesso! Você pode gerar o documento depois.");
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  // =========================================================================
  // GERAÇÃO DE WORD HÍBRIDA (DESKTOP VS WEB)
  // =========================================================================
  const gerarWordWeb = async (dadosExport: any, templateName: string) => {
    try {
      // Baixa o template da pasta public/templates/
      const response = await fetch(`/templates/${templateName}`);
      if (!response.ok) throw new Error("Template não encontrado na nuvem.");
      
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      const doc = new Docxtemplater(zip, { 
        paragraphLoop: true, 
        linebreaks: true,
        nullGetter() { return ""; }
      });

      doc.render(dadosExport);

      const blob = doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      // Dispara o download nativo do navegador
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const nomeAmigavel = dadosExport.nome_cliente.replace(/[^a-z0-9]/gi, '_');
      const prefixo = templateName.replace('.docx', '').replace('modelo_', '');
      link.download = `${prefixo}_${nomeAmigavel}_${Date.now()}.docx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro na geração web:", error);
      alert("Falha ao gerar o arquivo na versão Web.");
    }
  };

  const handleSalvarEGerarWord = async () => {
    setGerando(true);
    try {
      const valorTotal = await salvarNoBanco();
      const dataFormatada = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

      // O objeto de dados final (Formata as moedas e resolve os placeholders)
      const dadosExport = {
        nome_cliente: String(cliente.nome).toUpperCase(),
        cnpj_cliente: cliente.cnpj_cpf,
        endereco_cliente: String(cliente.endereco).toUpperCase(),
        endereço_cliente: String(cliente.endereco).toUpperCase(), // Suporte para acentuação no template
        data_extenso: dataFormatada,
        titulo_proposta: tipoSelecionado, 
        preco_total: formatarMoedaSegura(valorTotal),
        
        preco_assessoria_avcb: formatarMoedaSegura(precos.preco_assessoria_avcb),
        preco_sistema_incendio: formatarMoedaSegura(precos.preco_sistema_incendio),
        preco_brigada: formatarMoedaSegura(precos.preco_brigada),
        preco_atestado_gas: formatarMoedaSegura(precos.preco_atestado_gas),
        preco_atestado_alarme: formatarMoedaSegura(precos.preco_atestado_alarme),
        preco_atestado_pressurizacao: formatarMoedaSegura(precos.preco_atestado_pressurizacao),
        preco_atestado_eletrica: formatarMoedaSegura(precos.preco_atestado_eletrica),
        preco_atestado_cmar: formatarMoedaSegura(precos.preco_atestado_cmar),
        preco_sistema_hidrantes: formatarMoedaSegura(precos.preco_sistema_hidrantes),
        preco_atestado_shafts: formatarMoedaSegura(precos.preco_atestado_shafts),
        preco_atestado_gerador: formatarMoedaSegura(precos.preco_atestado_gerador),
        
        itens_sinalizacao: formatarItensParaWord(itensSinalizacao),
        itens_alarme: formatarItensParaWord(itensAlarme),
        itens_recalque: formatarItensParaWord(itensRecalque),
        itens_iluminacao: formatarItensParaWord(itensIluminacao),
        itens_bomba: formatarItensParaWord(itensBomba),
        itens_extintores: formatarItensParaWord(itensExtintores),
        itens_escadaria: formatarItensParaWord(itensEscadaria), 
      };

      // VERIFICA O AMBIENTE: Desktop (Electron) ou Web (Vercel)
      const isDesktop = navigator.userAgent.toLowerCase().includes('electron');

      if (isDesktop && (window as any).acorreaAPI?.gerarPropostaAssessoriaLaudos) {
        // Envia para o Worker do Node.js (que abre o arquivo automático)
        await (window as any).acorreaAPI.gerarPropostaAssessoriaLaudos(dadosExport);
      } else {
        // Gera direto no navegador web e baixa para a pasta Downloads
        let templateFileName = 'modelo_proposta_assessoria_laudos.docx';
        switch (tipoSelecionado) {
          case "Proposta Adequações: Sinalização de Emergência": templateFileName = 'modelo_proposta_adequacoes_sinalizacao.docx'; break;
          case "Proposta Adequações: Central de Alarme": templateFileName = 'modelo_proposta_adequacoes_central_alarme.docx'; break;
          case "Proposta Adequações: Registro de Recalque": templateFileName = 'modelo_proposta_adequacoes_registro_recalque.docx'; break;
          case "Proposta Adequações: Iluminação de Emergência": templateFileName = 'modelo_proposta_adequacoes_iluminacao.docx'; break;
          case "Proposta Adequações: Bomba de Incêndio": templateFileName = 'modelo_proposta_adequacoes_bomba.docx'; break;
          case "Proposta Adequações: Extintores": templateFileName = 'modelo_proposta_adequacoes_extintores.docx'; break;
          case "Proposta Adequações: Andares e Escadarias": templateFileName = 'modelo_proposta_adequacoes_escadaria.docx'; break;
        }
        await gerarWordWeb(dadosExport, templateFileName);
      }

      onClose(); 
    } catch (err: any) {
      alert("Erro na geração: " + err.message);
    } finally {
      setGerando(false);
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
                type="number" step="0.10" disabled={gerando || salvando} value={item.preco} 
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
                type="number" min="0" disabled={gerando || salvando} value={item.quantidade} 
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
        
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '70%' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
              Selecione o Tipo de Proposta:
            </label>
            <select 
              value={tipoSelecionado} 
              onChange={(e) => setTipoSelecionado(e.target.value)}
              disabled={gerando || salvando || !!orcamentoEditando} 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}            >
              {TIPOS_PROPOSTA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>
          
          {tipoSelecionado !== "Proposta Assessoria AVCB e Laudos" && (
            <button onClick={exportarParaExcel} style={btnExcelStyle}>
              📊 Exportar Itens
            </button>
          )}
        </div>

        <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '10px' }}>
          
          {tipoSelecionado === "Proposta Assessoria AVCB e Laudos" && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.keys(precos).map(key => (
                <div key={key}>
                  <label style={{ fontSize: '11px', color: '#555' }}>{key.replace('preco_', '').replace(/_/g, ' ').toUpperCase()}</label>
                  <input 
                    type="number" disabled={gerando || salvando}
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
          {tipoSelecionado === "Proposta Adequações: Extintores" && renderTabelaItens(itensExtintores, setItensExtintores)}
          {tipoSelecionado === "Proposta Adequações: Andares e Escadarias" && renderTabelaItens(itensEscadaria, setItensEscadaria)} 

        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#1a3353' }}>
          TOTAL DA PROPOSTA: R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <button onClick={onClose} disabled={gerando || salvando} style={btnCancelStyle}>Cancelar</button>
          
          <button onClick={handleApenasSalvar} disabled={gerando || salvando} style={btnOutlineGreenStyle}>
            {salvando ? '⏳ Salvando...' : '💾 Apenas Salvar'}
          </button>
          
          <button onClick={handleSalvarEGerarWord} disabled={gerando || salvando} style={btnSolidGreenStyle}>
            {gerando ? '⏳ Processando...' : '📄 Salvar e Gerar Word'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ESTILOS
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '95%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' };
const btnCancelStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontWeight: 'bold', color: '#555' };
const btnOutlineGreenStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #28a745', background: '#e8f5e9', color: '#28a745', fontWeight: 'bold' };
const btnSolidGreenStyle: React.CSSProperties = { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' };
const btnExcelStyle: React.CSSProperties = { padding: '10px 15px', backgroundColor: '#1d6f42', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', height: 'fit-content' };