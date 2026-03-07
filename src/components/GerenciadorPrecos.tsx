//src/components/GerenciadorPrecos.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function GerenciadorPrecos() {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');
  
  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    id: '',
    item_nome: '',
    preco_venda: '',
    categoria: '',
    unidade_medida: 'un',
    cor_autocad: '7'
  });

  useEffect(() => {
    fetchItens();
  }, []);

  async function fetchItens() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tabela_precos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('item_nome', { ascending: true });

      if (error) throw error;
      setItens(data || []);
    } catch (err: any) {
      alert("Erro ao buscar preços: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNovo = () => {
    setFormData({ id: '', item_nome: '', preco_venda: '', categoria: '', unidade_medida: 'un', cor_autocad: '7' });
    setIsModalOpen(true);
  };

  const handleOpenEditar = (item: any) => {
    setFormData({
      id: item.id,
      item_nome: item.item_nome,
      preco_venda: item.preco_venda.toString(),
      categoria: item.categoria || '',
      unidade_medida: item.unidade_medida || '',
      cor_autocad: item.cor_autocad?.toString() || '7'
    });
    setIsModalOpen(true);
  };

  const handleExcluir = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o item "${nome}"?`)) return;
    
    try {
      const { error } = await supabase.from('tabela_precos').delete().eq('id', id);
      if (error) throw error;
      fetchItens();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      item_nome: formData.item_nome,
      preco_venda: parseFloat(formData.preco_venda.replace(',', '.')),
      categoria: formData.categoria,
      unidade_medida: formData.unidade_medida,
      cor_autocad: parseInt(formData.cor_autocad)
    };

    try {
      if (formData.id) {
        // Atualizar
        const { error } = await supabase.from('tabela_precos').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        // Inserir Novo
        const { error } = await supabase.from('tabela_precos').insert([payload]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchItens();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const itensFiltrados = itens.filter(i => 
    i.item_nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
    i.categoria?.toLowerCase().includes(filtroBusca.toLowerCase())
  );

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1a3353' }}>💰 Tabela de Preços e Serviços</h2>
        <button onClick={handleOpenNovo} style={btnGreenStyle}>+ Novo Item</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 Buscar por nome ou categoria..." 
          style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} 
          value={filtroBusca} 
          onChange={(e) => setFiltroBusca(e.target.value)} 
        />
      </div>

      {loading ? (
        <p>Carregando tabela de preços...</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f8f9fa' }}>
                <th style={thStyle}>Nome do Item / Serviço</th>
                <th style={thStyle}>Categoria</th>
                <th style={thStyle}>Preço (R$)</th>
                <th style={thStyle}>Unid.</th>
                <th style={thStyle}>Cor CAD</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}><strong>{item.item_nome}</strong></td>
                  <td style={tdStyle}>{item.categoria}</td>
                  <td style={tdStyle}>R$ {Number(item.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style={tdStyle}>{item.unidade_medida}</td>
                  <td style={tdStyle}>{item.cor_autocad}</td>
                  <td style={tdStyle}>
                    <button onClick={() => handleOpenEditar(item)} style={btnBlueStyle}>✏️ Editar</button>
                    <button onClick={() => handleExcluir(item.id, item.item_nome)} style={btnRedStyle}>🗑️</button>
                  </td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Nenhum item encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      {isModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ marginTop: 0 }}>{formData.id ? '✏️ Editar Item' : '➕ Novo Item'}</h3>
            <form onSubmit={handleSalvar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nome do Item / Serviço *</label>
                <input required style={inputStyle} value={formData.item_nome} onChange={e => setFormData({...formData, item_nome: e.target.value})} />
              </div>

              <div>
                <label style={labelStyle}>Preço de Venda (R$) *</label>
                <input required type="number" step="0.01" style={inputStyle} value={formData.preco_venda} onChange={e => setFormData({...formData, preco_venda: e.target.value})} />
              </div>

              <div>
                <label style={labelStyle}>Categoria</label>
                <input list="categorias-list" style={inputStyle} value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ex: Sinalização, Serviços..." />
                <datalist id="categorias-list">
                  <option value="Andares e Escadarias" />
                  <option value="Bomba de Incêndio" />
                  <option value="Casa de Máquinas" />
                  <option value="Central de Alarme" />
                  <option value="Central de Medição" />
                  <option value="Detecção" />
                  <option value="Documentação" />
                  <option value="Extintores" />
                  <option value="Gerador" />
                  <option value="Hidrantes" />
                  <option value="Hidráulica" />
                  <option value="Iluminação de Emergência" />
                  <option value="Materiais de Acabamento" />
                  <option value="Porta Corta Fogo" />
                  <option value="Projeto Técnico" />
                  <option value="Registro de Recalque" />
                  <option value="Rota de Fuga" />
                  <option value="Serviços" />
                  <option value="Shaft" />
                  <option value="Sinalização" />
                  <option value="Sistema de Gás" />
                  <option value="Sistema de Interfone" />
                  <option value="Sistema de Pressurização" />
                  <option value="SPDA" />
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Unidade de Medida</label>
                <select style={inputStyle} value={formData.unidade_medida} onChange={e => setFormData({...formData, unidade_medida: e.target.value})}>
                  <option value="un">Unidade (un)</option>
                  <option value="sv">Serviço (sv)</option>
                  <option value="m">Metro (m)</option>
                  <option value="m²">Metro Quadrado (m²)</option>
                  <option value="cj">Conjunto (cj)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cor AutoCAD</label>
                <input type="number" style={inputStyle} value={formData.cor_autocad} onChange={e => setFormData({...formData, cor_autocad: e.target.value})} />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={btnCancelStyle}>Cancelar</button>
                <button type="submit" disabled={saving} style={btnGreenStyle}>{saving ? 'Salvando...' : 'Salvar Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ESTILOS
const tableStyle = { width: '100%', borderCollapse: 'collapse' as 'collapse' };
const thStyle = { padding: '12px 15px', color: '#555', borderBottom: '2px solid #ddd' };
const tdStyle = { padding: '12px 15px', color: '#333' };
const btnGreenStyle = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' as 'bold' };
const btnBlueStyle = { backgroundColor: '#f8f9fa', color: '#007bff', border: '1px solid #007bff', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', marginRight: '5px' };
const btnRedStyle = { backgroundColor: '#f8f9fa', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' };
const btnCancelStyle = { backgroundColor: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle: React.CSSProperties = { backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '500px', maxWidth: '90%' };
const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#555' };
const inputStyle = { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as 'border-box' };