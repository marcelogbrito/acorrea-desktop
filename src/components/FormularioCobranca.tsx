import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function FormularioCobranca({ clienteId, onSucesso, onCancelar }: any) {
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [primeiroVencimento, setPrimeiroVencimento] = useState('')

  const gerarCobranca = async () => {
    const valorNum = parseFloat(valorTotal)
    const valorParcela = valorNum / parcelas
    const listaReceitas = []

    for (let i = 0; i < parcelas; i++) {
      const dataVenc = new Date(primeiroVencimento)
      dataVenc.setMonth(dataVenc.getMonth() + i) // Incrementa meses

      listaReceitas.push({
        cliente_id: clienteId,
        discriminacao_servicos: `${descricao} (Parcela ${i + 1}/${parcelas})`,
        valor_receber: valorParcela,
        valor_parcela: valorParcela,
        nr_parcela: i + 1,
        qt_parcelas: parcelas,
        data_vencimento: dataVenc.toISOString().split('T')[0],
        situacao: 'Pendente',
        parcelado: parcelas > 1
      })
    }

    const { error } = await supabase.from('receitas').insert(listaReceitas)

    if (error) alert("Erro ao cadastrar cobrança: " + error.message)
    else {
      alert("Cobrança(s) cadastrada(s) com sucesso!")
      onSucesso()
    }
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>💰 Nova Cobrança (Receita)</h3>
        <label>Descrição do Negócio</label>
        <input style={inputStyle} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Assessoria AVCB 2026" />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
          <div>
            <label>Valor Total (R$)</label>
            <input style={inputStyle} type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)} />
          </div>
          <div>
            <label>Nº Parcelas</label>
            <input style={inputStyle} type="number" min="1" value={parcelas} onChange={e => setParcelas(parseInt(e.target.value))} />
          </div>
        </div>

        <label style={{ display: 'block', marginTop: '10px' }}>Data do 1º Vencimento</label>
        <input style={inputStyle} type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} />

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={btnCancelStyle}>Cancelar</button>
          <button onClick={gerarCobranca} style={btnConfirmStyle}>Gerar Títulos</button>
        </div>
      </div>
    </div>
  )
}

// Estilos rápidos para layout
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '450px' }
const inputStyle = { width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' as 'border-box' }
const btnConfirmStyle = { padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }
const btnCancelStyle = { padding: '10px 20px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }