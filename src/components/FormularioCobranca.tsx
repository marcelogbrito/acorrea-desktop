import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function FormularioCobranca({ clienteId, onSucesso, onCancelar, receitaEditando }: any) {
  const [descricao, setDescricao] = useState('')
  const [modoCobranca, setModoCobranca] = useState<'total' | 'parcela'>('total')
  const [valorPrincipal, setValorPrincipal] = useState('')
  const [valorEntrada, setValorEntrada] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [primeiroVencimento, setPrimeiroVencimento] = useState('')

  // PREENCHE OS DADOS SE ESTIVER EM MODO EDIÇÃO
  useEffect(() => {
    if (receitaEditando) {
      setDescricao(receitaEditando.discriminacao_servicos || '')
      const valorFormatado = receitaEditando.valor_receber ? String(receitaEditando.valor_receber).replace('.', ',') : ''
      setValorPrincipal(valorFormatado)
      setPrimeiroVencimento(receitaEditando.data_vencimento || '')
      setParcelas(1)
      setValorEntrada('')
    } else {
      // Garante que o form inicie limpo
      setDescricao('')
      setValorPrincipal('')
      setValorEntrada('')
      setPrimeiroVencimento('')
      setParcelas(1)
      setModoCobranca('total')
    }
  }, [receitaEditando])

  // Ajuda a limpar os inputs para não ter letras
  const limparNumero = (val: string) => val.replace(/[^0-9.,]/g, '')

  const gerarCobranca = async () => {
    const valPrincipalNum = parseFloat(String(valorPrincipal).replace(',', '.')) || 0
    const valEntradaNum = parseFloat(String(valorEntrada).replace(',', '.')) || 0

    if (valPrincipalNum <= 0) {
      alert("Por favor, insira um valor válido.")
      return
    }
    if (!primeiroVencimento) {
      alert("Por favor, informe a data de vencimento.")
      return
    }

    if (receitaEditando) {
      // --- MODO EDIÇÃO SIMPLES ---
      // A MÁGICA DOS CENTAVOS: Garante que NUNCA passará de 2 casas decimais no banco
      const valorFinalSeguro = Number(valPrincipalNum.toFixed(2))

      const { error } = await supabase.from('receitas').update({
        discriminacao_servicos: descricao,
        valor_receber: valorFinalSeguro,
        valor_parcela: valorFinalSeguro,
        data_vencimento: primeiroVencimento 
      }).eq('id', receitaEditando.id)

      if (error) alert("Erro ao editar cobrança: " + error.message)
      else {
        alert("Cobrança atualizada com sucesso!")
        onSucesso()
      }
    } else {
      // --- MODO DE CRIAÇÃO AVANÇADO ---
      const qtd = parcelas || 1
      let valorDaParcela = 0

      // Cálculos baseados no modo selecionado
      if (modoCobranca === 'total') {
        if (valPrincipalNum < valEntradaNum) {
          alert("A entrada não pode ser maior que o valor total.")
          return
        }
        valorDaParcela = (valPrincipalNum - valEntradaNum) / qtd
      } else {
        // Modo Parcela Fixa
        valorDaParcela = valPrincipalNum
      }

      // A MÁGICA DOS CENTAVOS: Arredonda e corta qualquer número após a segunda casa (Ex: 33.3333 vira 33.33)
      const parcelaArredondada = Number(valorDaParcela.toFixed(2))
      const entradaArredondada = Number(valEntradaNum.toFixed(2))

      const listaReceitas = []
      const [ano, mes, dia] = primeiroVencimento.split('-').map(Number)
      
      let offsetMes = 0 // Usado para jogar as parcelas pro mês seguinte caso haja entrada

      // 1. GERAR A ENTRADA (Se o usuário preencheu)
      if (entradaArredondada > 0) {
        const dataEntrada = new Date(ano, mes - 1, dia, 12, 0, 0)
        
        listaReceitas.push({
          cliente_id: clienteId,
          discriminacao_servicos: `${descricao} (Entrada)`,
          valor_receber: entradaArredondada,
          valor_parcela: entradaArredondada,
          nr_parcela: 0, 
          qt_parcelas: qtd,
          data_vencimento: dataEntrada.toISOString().split('T')[0],
          situacao: 'a_receber',
          parcelado: true
        })
        
        offsetMes = 1 // As demais parcelas vão cair no próximo mês
      }

      // 2. GERAR AS DEMAIS PARCELAS
      for (let i = 0; i < qtd; i++) {
        // Se tem entrada (offsetMes = 1), a parcela 1 é no mês seguinte. Se não, é no mês selecionado.
        const dataVenc = new Date(ano, mes - 1 + offsetMes + i, dia, 12, 0, 0)
        
        listaReceitas.push({
          cliente_id: clienteId,
          discriminacao_servicos: `${descricao} (Parcela ${i + 1}/${qtd})`,
          valor_receber: parcelaArredondada,
          valor_parcela: parcelaArredondada,
          nr_parcela: i + 1,
          qt_parcelas: qtd,
          data_vencimento: dataVenc.toISOString().split('T')[0],
          situacao: 'a_receber',
          parcelado: qtd > 1 || entradaArredondada > 0
        })
      }

      const { error } = await supabase.from('receitas').insert(listaReceitas)

      if (error) alert("Erro ao cadastrar cobrança: " + error.message)
      else {
        alert("Cobrança(s) cadastrada(s) com sucesso!")
        onSucesso()
      }
    }
  }

  // Gera o resumo visual para ajudar o usuário a saber se a conta bate
  const getResumo = () => {
    const valPrin = parseFloat(String(valorPrincipal).replace(',', '.')) || 0
    const valEnt = parseFloat(String(valorEntrada).replace(',', '.')) || 0
    const qtd = parcelas || 1

    if (valPrin <= 0) return ""

    if (modoCobranca === 'total') {
      const valParc = (valPrin - valEnt) / qtd
      return `💸 Total: R$ ${valPrin.toFixed(2)} = ${valEnt > 0 ? `Entrada R$ ${valEnt.toFixed(2)} + ` : ''}${qtd}x de R$ ${valParc.toFixed(2)}`
    } else {
      const total = valEnt + (valPrin * qtd)
      return `💸 Total: R$ ${total.toFixed(2)} = ${valEnt > 0 ? `Entrada R$ ${valEnt.toFixed(2)} + ` : ''}${qtd}x de R$ ${valPrin.toFixed(2)}`
    }
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>{receitaEditando ? '✏️ Editar Cobrança' : '💰 Nova Cobrança (Receita)'}</h3>
        
        <label>Descrição do Negócio / Serviços</label>
        <textarea 
          style={{ ...inputStyle, height: '70px', resize: 'vertical', fontFamily: 'inherit' }} 
          value={descricao} 
          onChange={e => setDescricao(e.target.value)} 
          placeholder="Ex: Assessoria AVCB 2026, emissão de laudos..." 
        />
        
        {!receitaEditando && (
          <div style={radioContainerStyle}>
            <label style={radioLabelStyle}>
              <input type="radio" checked={modoCobranca === 'total'} onChange={() => setModoCobranca('total')} />
              Dividir Valor Total
            </label>
            <label style={radioLabelStyle}>
              <input type="radio" checked={modoCobranca === 'parcela'} onChange={() => setModoCobranca('parcela')} />
              Multiplicar Valor Parcela
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: receitaEditando ? '1fr' : '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
          
          <div style={{ gridColumn: receitaEditando ? 'span 1' : 'span 2' }}>
            <label>{receitaEditando ? 'Valor da Cobrança (R$)' : (modoCobranca === 'total' ? 'Valor Total (R$)' : 'Valor da Parcela (R$)')}</label>
            <input 
              style={inputStyle} 
              type="text" 
              inputMode="decimal"
              value={valorPrincipal} 
              onChange={e => setValorPrincipal(limparNumero(e.target.value))}
              placeholder="0,00"
            />
          </div>

          {!receitaEditando && (
            <div>
              <label>Nº Parcelas</label>
              <input 
                style={inputStyle} 
                type="number" 
                min="1" 
                value={parcelas} 
                onChange={e => setParcelas(parseInt(e.target.value) || 1)} 
              />
            </div>
          )}
        </div>

        {!receitaEditando && (
          <div>
            <label>Valor de Entrada Opcional (R$)</label>
            <input 
              style={inputStyle} 
              type="text" 
              inputMode="decimal"
              value={valorEntrada} 
              onChange={e => setValorEntrada(limparNumero(e.target.value))}
              placeholder="0,00 (Deixe em branco se não houver)"
            />
          </div>
        )}

        <label style={{ display: 'block', marginTop: '10px' }}>
          Data do {valorEntrada ? 'Pagamento da Entrada' : '1º Vencimento'}
        </label>
        <input style={inputStyle} type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} />

        {!receitaEditando && (
          <div style={resumoStyle}>{getResumo()}</div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={btnCancelStyle}>Cancelar</button>
          <button onClick={gerarCobranca} style={btnConfirmStyle}>{receitaEditando ? 'Salvar Alterações' : 'Gerar Títulos'}</button>
        </div>
      </div>
    </div>
  )
}

// Estilos
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' as 'border-box', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }
const btnConfirmStyle = { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
const btnCancelStyle = { padding: '10px 20px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
const radioContainerStyle: React.CSSProperties = { display: 'flex', gap: '15px', marginBottom: '15px', padding: '10px', backgroundColor: '#f4f7f6', borderRadius: '6px' }
const radioLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', color: '#1a3353' }
const resumoStyle: React.CSSProperties = { marginTop: '10px', padding: '10px', backgroundColor: '#e7f3ff', color: '#0056b3', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }