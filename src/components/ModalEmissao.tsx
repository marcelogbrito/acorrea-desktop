import { useState } from 'react'

interface ModalEmissaoProps {
  cliente: any;
  onConfirm: (dados: { valor: string, descricao: string }) => void;
  onCancel: () => void;
}

export function ModalEmissao({ cliente, onConfirm, onCancel }: ModalEmissaoProps) {
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('PREPARAÇÃO DE DOCUMENTOS E SERVIÇOS ESPECIALIZADOS DE APOIO ADMINISTRATIVO NÃO ESPECIFICADOS')

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '500px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
        <h3 style={{ marginTop: 0 }}>📄 Detalhes da Nota Fiscal</h3>
        <p><strong>Cliente:</strong> {cliente.nome}</p>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Valor Total (R$)</label>
          <input 
            type="text" 
            placeholder="0.00"
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Discriminação dos Serviços</label>
          <textarea 
            rows={4}
            style={{ width: '100%', padding: '10px', fontFamily: 'inherit' }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', cursor: 'pointer' }}>Cancelar</button>
          <button 
            disabled={!valor || !descricao}
            onClick={() => onConfirm({ valor, descricao })}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold' 
            }}
          >
            🚀 Iniciar Emissão
          </button>
        </div>
      </div>
    </div>
  )
}