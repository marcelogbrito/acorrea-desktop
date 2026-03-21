//automation\proposal_worker.ts
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';

// --- Função Auxiliar: Converter Número para Extenso (Reais) ---
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

// Formata para o padrão exigido: "R$ 600,00 (seiscentos reais)" COM TRAVA DE SEGURANÇA
const formatarMoedaSegura = (valor: any) => {
  if (valor === undefined || valor === null || valor === '') return '';
  
  let num = valor;
  // Se o React enviar a string formatada em R$, extraímos apenas o número
  if (typeof valor === 'string') {
     num = parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.'));
     if (isNaN(num)) return valor; // Se não for número, devolve o texto puro
  }

  const formatado = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${formatado} (${valorPorExtenso(num)})`;
};

export async function gerarPropostaAssessoriaLaudos(
  dadosTela: any, 
  caminhoTemplate: string, 
  caminhoSaida: string
) {
  // Gera a data por extenso (Ex: 20 de fevereiro de 2026)
  const dataFormatada = new Date().toLocaleDateString('pt-BR', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });

  // Mapeamento das tags - Unindo tudo o que vem da tela (incluindo as listas)
  const dados = {
    ...dadosTela, // <-- MÁGICA AQUI: Traz itens_sinalizacao, itens_alarme, etc., automaticamente
    
    nome_cliente: dadosTela.nome_cliente ? String(dadosTela.nome_cliente).toUpperCase() : '',
    endereco_cliente: dadosTela.endereco_cliente ? String(dadosTela.endereco_cliente).toUpperCase() : '',
    endereço_cliente: dadosTela.endereco_cliente ? String(dadosTela.endereco_cliente).toUpperCase() : '', // Redundância para evitar erro com 'ç'
    cnpj_cliente: dadosTela.cnpj_cliente || '',
    data_extenso: dataFormatada,
    
    // Valores formatados de forma segura (Mantendo a lógica da proposta antiga)
    preco_assessoria_avcb: formatarMoedaSegura(dadosTela.preco_assessoria_avcb),
    preco_sistema_incendio: formatarMoedaSegura(dadosTela.preco_sistema_incendio),
    preco_brigada: formatarMoedaSegura(dadosTela.preco_brigada),
    preco_atestado_gas: formatarMoedaSegura(dadosTela.preco_atestado_gas),
    preco_atestado_alarme: formatarMoedaSegura(dadosTela.preco_atestado_alarme),
    preco_atestado_pressurizacao: formatarMoedaSegura(dadosTela.preco_atestado_pressurizacao),
    preco_atestado_eletrica: formatarMoedaSegura(dadosTela.preco_atestado_eletrica),
    preco_atestado_cmar: formatarMoedaSegura(dadosTela.preco_atestado_cmar),
    preco_sistema_hidrantes: formatarMoedaSegura(dadosTela.preco_sistema_hidrantes),
    preco_atestado_shafts: formatarMoedaSegura(dadosTela.preco_atestado_shafts),
    preco_atestado_gerador: formatarMoedaSegura(dadosTela.preco_atestado_gerador),
    preco_total: formatarMoedaSegura(dadosTela.preco_total),
  };

  const content = fs.readFileSync(caminhoTemplate, 'binary');
  const zip = new PizZip(content);
  
  // MÁGICA 2: Configuração avançada do Docxtemplater
  const doc = new Docxtemplater(zip, { 
    paragraphLoop: true, 
    linebreaks: true, // Garante que a lista de itens fique linha abaixo de linha
    nullGetter(part) {
      if (!part.module) return "";
      if (part.module === "rawxml") return "";
      return ""; // Se uma tag do word (ex: {itens_bomba}) não existir, fica em branco e não "undefined"
    }
  });

  try {
    doc.render(dados);
  } catch (error: any) {
    throw new Error(`Erro renderização Word: ${JSON.stringify(error)}`);
  }

  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync(caminhoSaida, buf);

  return { success: true, caminho: caminhoSaida };
}