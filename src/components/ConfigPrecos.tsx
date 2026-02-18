import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function ConfigPrecos() {
  const [precos, setPrecos] = useState<any[]>([])
  const [editando, setEditando] = useState<any | null>(null)

  useEffect(() => { fetchPrecos() }, [])

  async function fetchPrecos() {
    const { data } = await supabase.from('tabela_precos').select('*').order('categoria')
    setPrecos(data || [])
  }

  const salvarPreco = async (item: any) => {
    const { error } = await supabase.from('tabela_precos').update({ preco_venda: item.preco_venda }).eq('id', item.id)
    if (!error) {
      alert("Preço atualizado com sucesso!")
      setEditando(null)
      fetchPrecos()
    }
  }

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0 }}>💰 Tabela de Preços Global</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f7f6', textAlign: 'left' }}>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>Categoria</th>
            <th style={thStyle}>Preço Unitário (R$)</th>
            <th style={thStyle}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {precos.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={tdStyle}>{p.item_nome}</td>
              <td style={tdStyle}><span style={badgeStyle}>{p.categoria}</span></td>
              <td style={tdStyle}>
                {editando?.id === p.id ? (
                  <input 
                    type="number" 
                    value={editando.preco_venda} 
                    onChange={e => setEditando({...editando, preco_venda: parseFloat(e.target.value)})}
                    style={{ width: '100px', padding: '5px' }}
                  />
                ) : (
                  `R$ ${p.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                )}
              </td>
              <td style={tdStyle}>
                {editando?.id === p.id ? (
                  <button onClick={() => salvarPreco(editando)} style={btnSaveStyle}>Salvar</button>
                ) : (
                  <button onClick={() => setEditando(p)} style={btnEditStyle}>Editar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle = { padding: '12px', color: '#666', fontSize: '13px' };
const tdStyle = { padding: '12px', fontSize: '14px' };
const badgeStyle = { backgroundColor: '#eef2f7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' };
const btnEditStyle = { background: 'none', border: '1px solid #007bff', color: '#007bff', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' };
const btnSaveStyle = { backgroundColor: '#28a745', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '4px 12px' };