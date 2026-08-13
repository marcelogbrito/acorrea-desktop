import React, { useState } from 'react';
// Importações para geração WEB
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';


interface ModalProps {
  cliente: any;
  onClose: () => void;
}

const LISTA_LAUDOS = [
  { id: 'alarme', nome: 'Alarme', arquivo: 'modelo_atestado_alarme.docx' },
  { id: 'medidas', nome: 'Medidas de Segurança', arquivo: 'modelo_atestado_medidas_seguranca.docx' },
  { id: 'pressurizacao', nome: 'Pressurização de Escadas', arquivo: 'modelo_atestado_pressurizacao_escadas.docx' },
  { id: 'eletrica', nome: 'Instalações Elétricas', arquivo: 'modelo_atestado_eletrica.docx' },
  { id: 'hidrantes', nome: 'Hidrantes e Mangotinhos', arquivo: 'modelo_atestado_hidrantes_mangotinhos.docx' },
  { id: 'spda', nome: 'SPDA (Para-raios)', arquivo: 'modelo_atestado_spda.docx' },
  { id: 'shafts', nome: 'Selagem de Shafts', arquivo: 'modelo_atestado_selagem_shafts.docx' },
  { id: 'gas', nome: 'Instalações de Gás', arquivo: 'modelo_atestado_gas.docx' },
  { id: 'equipamentos', nome: 'Equipamentos de Segurança', arquivo: 'modelo_atestado_equipamentos_seguranca.docx' },
  { id: 'cmar', nome: 'CMAR', arquivo: 'modelo_atestado_CMAR.docx' },
  { id: 'gerador', nome: 'Grupo Motogerador', arquivo: 'modelo_atestado_grupo_motogerador.docx' },
  { id: 'sprinkler', nome: 'Chuveiros Automáticos', arquivo: 'modelo_atestado_sprinkler.docx' },
];

export function ModalGeradorLaudos({ cliente, onClose }: ModalProps) {
  const [gerando, setGerando] = useState(false);
  const [nrRrt, setNrRrt] = useState('');
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});

  const handleToggle = (id: string) => {
    setSelecionados(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Função dedicada para geração na Web
  const gerarLaudoWeb = async (laudo: any, dadosTemplate: any, nomeAmigavel: string) => {
    try {
      const response = await fetch(`/templates/${laudo.arquivo}`);
      if (!response.ok) throw new Error(`Template ${laudo.arquivo} não encontrado na pasta public/templates.`);
      
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render(dadosTemplate);

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // ✅ Usando a API nativa do navegador (igual ao ModalNovaProposta)
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Atestado_${laudo.nome}_${nomeAmigavel}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error(`Erro ao gerar ${laudo.nome}:`, error);
      throw error;
    }
  };

  const gerarLaudos = async () => {
    const laudosParaGerar = LISTA_LAUDOS.filter(l => selecionados[l.id]);

    if (laudosParaGerar.length === 0) {
      return alert("Selecione pelo menos um laudo para gerar.");
    }

    setGerando(true);
    try {
      // Verifica se está no Desktop (Electron)
      // @ts-ignore
      const isDesktop = typeof window !== 'undefined' && window.acorreaAPI;

      if (isDesktop) {
        // MODO DESKTOP (Electron)
        const payload = {
          cliente,
          laudosSelecionados: laudosParaGerar,
          nr_rrt: nrRrt
        };
        // @ts-ignore
        await window.acorreaAPI.gerarLaudosLote(payload);
        alert(`✅ ${laudosParaGerar.length} Laudo(s) gerado(s) com sucesso na pasta Downloads do PC!`);
      
      } else {
        // MODO WEB (Browser)
        const dataFormatada = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        const nomeAmigavel = cliente.nome.replace(/[^a-z0-9]/gi, '_');

        // Prepara os dados que vão substituir as chaves no Word
        const dadosTemplate = {
          nome_cliente: String(cliente.nome).toUpperCase(),
          endereco_cliente: String(cliente.endereco).toUpperCase(),
          endereço_cliente: String(cliente.endereco).toUpperCase(), // Para garantir se a tag tiver ç
          data_extenso: dataFormatada,
          nr_rrt: nrRrt || 'NÃO INFORMADO'
        };

        // Roda a geração para cada laudo selecionado
        for (const laudo of laudosParaGerar) {
          await gerarLaudoWeb(laudo, dadosTemplate, nomeAmigavel);
        }
        
        alert(`✅ ${laudosParaGerar.length} Laudo(s) baixado(s) com sucesso!`);
      }

      onClose();
    } catch (err: any) {
      alert("Erro ao gerar laudos: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>📄 Emissão de Laudos Técnicos e Atestados</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          Selecione os documentos desejados e preencha o número do RRT vinculado.
        </p>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Número do RRT (Deixe em branco se não aplicável)</label>
          <input 
            type="text" 
            placeholder="Ex: 123456789" 
            style={inputStyle} 
            value={nrRrt}
            onChange={(e) => setNrRrt(e.target.value)}
          />
        </div>

        <div style={listaStyle}>
          {LISTA_LAUDOS.map(laudo => (
            <label key={laudo.id} style={checkboxItemStyle}>
              <input 
                type="checkbox" 
                checked={selecionados[laudo.id] || false} 
                onChange={() => handleToggle(laudo.id)}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ marginLeft: '10px', fontSize: '15px' }}>{laudo.nome}</span>
            </label>
          ))}
        </div>

        <div style={actionsStyle}>
          <button onClick={onClose} style={btnCancelStyle}>Cancelar</button>
          <button onClick={gerarLaudos} disabled={gerando} style={btnBlueStyle}>
            {gerando ? 'Gerando Documentos...' : 'Gerar Laudos Selecionados'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ESTILOS
const overlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle: React.CSSProperties = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '600px', maxHeight: '90vh', overflowY: 'auto' };
const inputGroupStyle: React.CSSProperties = { marginBottom: '20px' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' };
const listaStyle: React.CSSProperties = { border: '1px solid #eee', borderRadius: '8px', padding: '10px', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#f9f9f9' };
const checkboxItemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eaeaea', cursor: 'pointer' };
const actionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' };
const btnCancelStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', border: '1px solid #ccc', backgroundColor: '#fff', borderRadius: '6px' };
const btnBlueStyle: React.CSSProperties = { padding: '10px 20px', cursor: 'pointer', border: 'none', backgroundColor: '#007bff', color: '#fff', borderRadius: '6px', fontWeight: 'bold' };