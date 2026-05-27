//src\components\VistoriaDetalhes.tsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

// --- COMPONENTES AUXILIARES DE UI ---

const Section = ({ title, children, isOpen, onToggle }: any) => (
  <div style={{ border: '1px solid #ddd', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden', background: '#fff' }}>
    <div onClick={onToggle} style={{ background: '#f8f9fa', padding: '12px 15px', cursor: 'pointer', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1a3353', borderBottom: isOpen ? '1px solid #eee' : 'none' }}>
      <span>{title}</span>
      <span style={{ fontSize: '12px', color: '#999' }}>{isOpen ? '▼' : '▶'}</span>
    </div>
    {isOpen && <div style={{ padding: '20px' }}>{children}</div>}
  </div>
);

const BooleanRow = ({ label, field, value, onChange, noteField, noteValue }: any) => (
  <div style={rowStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', gap: '15px' }}>
        <label style={radioLabelStyle}>
          <input type="radio" checked={value === true} onChange={() => onChange(field, true)} /> Sim
        </label>
        <label style={radioLabelStyle}>
          <input type="radio" checked={value === false} onChange={() => onChange(field, false)} /> Não
        </label>
      </div>
    </div>
    {noteField && (
       <input 
         placeholder="Anotação..." 
         value={noteValue || ''} 
         onChange={(e) => onChange(noteField, e.target.value)}
         style={miniInputStyle}
       />
    )}
  </div>
);

const TextRow = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (  
  <div style={rowStyle}>
    <label style={labelStyle}>{label}</label>
    <input 
      type={type}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={fullWidthInputStyle}
    />
  </div>
);

const OptionsRow = ({ label, field, value, onChange, options }: any) => (
  <div style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
      {options.map((opt: any) => (
        <label key={opt.value} style={radioLabelStyle}>
          <input 
            type="radio" 
            name={field} 
            checked={value === opt.value} 
            onChange={() => onChange(field, opt.value)} 
          /> {opt.label}
        </label>
      ))}
    </div>
  </div>
);

const ParecerButtons = ({ onSelect }: any) => {
  const options = [
    { text: "Atendendo os requisitos para emissão do atestado.", color: "#28a745", label: "Conforme" },
    { text: "Atendendo parcialmente os requisitos para emissão do atestado.", color: "#ffc107", label: "Parcial" },
    { text: "Não atende os requisitos para emissão do atestado.", color: "#dc3545", label: "Não Conforme" }
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onSelect(opt.text)}
          style={{
            padding: '4px 8px', fontSize: '11px', cursor: 'pointer', backgroundColor: 'white', color: opt.color,
            border: `1px solid ${opt.color}`, borderRadius: '4px', fontWeight: 'bold', transition: 'all 0.2s'
          }}
          onMouseEnter={(e: any) => { e.target.style.backgroundColor = opt.color; e.target.style.color = 'white'; }}
          onMouseLeave={(e: any) => { e.target.style.backgroundColor = 'white'; e.target.style.color = opt.color; }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const ConclusaoButtons = ({ onSelect }: any) => {
  const options = [
    { 
      label: "Adequação Rápida", 
      text: "Sugerimos a rápida adequação dos itens apontados antes de solicitar a vistoria oficial do Corpo de Bombeiros. Como são itens de baixa expressão e rápida execução, torna-se viável a emissão dos laudos e atestados exigidos pela corporação.",
      color: "#007bff" 
    },
    { 
      label: "Totalmente Conforme", 
      text: "Informamos que a edificação encontra-se em total conformidade com as normas vigentes, estando apta para a solicitação de vistoria oficial.", 
      color: "#28a745" 
    }
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onSelect(opt.text)}
          style={{
            padding: '6px 12px', fontSize: '12px', cursor: 'pointer', backgroundColor: 'white', color: opt.color,
            border: `1px solid ${opt.color}`, borderRadius: '4px', fontWeight: 'bold', transition: 'all 0.2s'
          }}
          onMouseEnter={(e: any) => { e.target.style.backgroundColor = opt.color; e.target.style.color = 'white'; }}
          onMouseLeave={(e: any) => { e.target.style.backgroundColor = 'white'; e.target.style.color = opt.color; }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};


// ==========================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO (Mapeamento Word)
// ==========================================
const X = '(X)';
const O = '( )';
const check = (val: any) => (val === true ? X : O);
const checkInv = (val: any) => (val === false ? X : O);
const checkEnum = (val: any, expected: string) => (val === expected ? X : O);
const safeStr = (str: string | null | undefined) => (str ? str.toUpperCase() : '');
const fmtDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '___/___/_____';
  try { return new Date(dateStr).toLocaleDateString('pt-BR'); } 
  catch (e) { return '___/___/_____'; }
};


// --- COMPONENTE PRINCIPAL ---
export function VistoriaDetalhes({ vistoriaId, onBack }: any) {
  const [vistoria, setVistoria] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [openSections, setOpenSections] = useState<any>({ 
    geral: true, bi: false, cm: false, ae: false, ma: false, 
    pcf: false, ext: false, hid: false, ie: false, sh: false, 
    sin: false, ca: false, rf: false, cm_med: false, si: false, 
    sg: false, ger: false, sp: false, rr: false, conclusao: false 
  });

  useEffect(() => { loadData(); }, [vistoriaId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: v, error } = await supabase
        .from('vistoria_previa_avcb')
        .select('*, checklist_vistoria_avcb(*)')
        .eq('id', vistoriaId)
        .single();
      if (error) throw error;
      if (v) {
        setVistoria(v);
        const cl = Array.isArray(v.checklist_vistoria_avcb) ? v.checklist_vistoria_avcb[0] : v.checklist_vistoria_avcb;
        setChecklist(cl || {});
      }
    } catch (err: any) { console.error("Erro ao carregar:", err.message); } finally { setLoading(false); }
  }

  const updateField = useCallback((field: string, value: any) => {
    setChecklist((prev: any) => {
      if (prev && prev[field] === value) return prev; 
      return { ...prev, [field]: value };
    });
  }, []);

  const appendText = (field: string, text: string) => {
    const currentVal = checklist[field] || '';
    const newVal = currentVal.trim().length > 0 ? `${currentVal}\n${text}` : text;
    updateField(field, newVal);
  };

  const handleSave = async (silent = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const { error: errHeader } = await supabase.from('vistoria_previa_avcb').update({
        nome_edificacao: vistoria.nome_edificacao,
        endereco_edificacao: vistoria.endereco_edificacao,
        qtd_pavimentos: vistoria.qtd_pavimentos,
        qtd_subsolos: vistoria.qtd_subsolos,
        nome_pessoa_acompanhou: vistoria.nome_pessoa_acompanhou,
        cargo_pessoa_acompanhou: vistoria.cargo_pessoa_acompanhou,
        telefone_pessoa_acompanhou: vistoria.telefone_pessoa_acompanhou,
        tipo_edificacao: vistoria.tipo_edificacao,
        vistoria_com_projeto: vistoria.vistoria_com_projeto
      }).eq('id', vistoriaId);

      if (errHeader) throw new Error("Erro ao salvar cabeçalho: " + errHeader.message);

      const { id, ...dadosSemId } = checklist;
      const dadosChecklist = { ...dadosSemId, vistoria_previa_id: vistoriaId };

      const { data: savedChecklist, error: errChecklist } = await supabase
        .from('checklist_vistoria_avcb')
        .upsert(dadosChecklist, { onConflict: 'vistoria_previa_id' })
        .select('id').single();
      
      if (errChecklist) throw new Error("Erro ao salvar checklist: " + errChecklist.message);

      if (savedChecklist && !checklist.id) setChecklist((prev: any) => ({ ...prev, id: savedChecklist.id }));
      if (!silent) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
    } catch (err: any) { alert("Erro ao salvar: " + err.message); } finally { setSaving(false); }
  };

  const gerarRelatorioWeb = async (dadosExport: any) => {
    try {
      const response = await fetch('/templates/modelo_vistoria_previa.docx');
      if (!response.ok) throw new Error("Template não encontrado na nuvem.");
      
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });

      doc.render(dadosExport);

      const blob = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const nomeAmigavel = vistoria.nome_edificacao ? vistoria.nome_edificacao.replace(/[^a-z0-9]/gi, '_') : 'edificacao';
      link.download = `Relatorio_Vistoria_${nomeAmigavel}.docx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) { alert("Erro na geração web do relatório."); }
  };

  const handleGerarRelatorio = async () => {
    await handleSave(true);
    if (!window.confirm("Gerar relatório Word agora?")) return;
    
    try {
      const v = vistoria || {};
      const c = checklist || {};

      // EXATO MAPEAMENTO DO REPORT_WORKER.TS
      const dadosExport = {
        nome_edificacao: safeStr(v.nome_edificacao),
        endereco: safeStr(v.endereco_edificacao),
        pavimentos: v.qtd_pavimentos || '',
        subsolos: v.qtd_subsolos || '',
        tipo_residencial: checkEnum(v.tipo_edificacao, 'Residencial'),
        tipo_comercial: checkEnum(v.tipo_edificacao, 'Comercial'),
        tipo_misto: checkEnum(v.tipo_edificacao, 'Misto'),
        blocos: v.qtd_blocos || '',
        acompanhante: v.nome_pessoa_acompanhou || '',
        cargo: v.cargo_pessoa_acompanhou || '',
        telefone: v.telefone_pessoa_acompanhou || '',
        com_projeto_sim: check(v.vistoria_com_projeto),
        com_projeto_nao: checkInv(v.vistoria_com_projeto),
        vistoriador: 'Rafael Corrêa', // Pode substituir se for dinâmico

        // BOMBA
        bi_existe_sim: check(c.bi_existe_bomba),
        bi_existe_nao: checkInv(c.bi_existe_bomba),
        bi_pcf_sim: check(c.bi_protegida_pcf),
        bi_pcf_nao: checkInv(c.bi_protegida_pcf),
        bi_nec_pcf_sim: check(c.bi_necessidade_pcf),
        bi_nec_pcf_nao: checkInv(c.bi_necessidade_pcf),
        bi_bot_barrilete_sim: check(c.bi_botoeira_barrilete),
        bi_bot_barrilete_nao: checkInv(c.bi_botoeira_barrilete),
        bi_bot_pav_sim: check(c.bi_botoeira_pavimentos),
        bi_bot_pav_nao: checkInv(c.bi_botoeira_pavimentos),
        bi_teste_sim: check(c.bi_teste_funcionou),
        bi_teste_nao: checkInv(c.bi_teste_funcionou),
        bi_bypass_sim: check(c.bi_existe_bypass),
        bi_bypass_nao: checkInv(c.bi_existe_bypass),
        bi_medidor_sim: check(c.bi_medidor_eletrico),
        bi_medidor_nao: checkInv(c.bi_medidor_eletrico),
        bi_ext_agua: checkEnum(c.bi_tipo_extintor, 'Água'),
        bi_ext_pqs:  checkEnum(c.bi_tipo_extintor, 'PQS'),
        bi_ext_co2:  checkEnum(c.bi_tipo_extintor, 'CO²'),
        bi_ext_abc:  checkEnum(c.bi_tipo_extintor, 'ABC'),
        bi_loc_fora:   checkEnum(c.bi_local_extintor, 'Fora'),
        bi_loc_dentro: checkEnum(c.bi_local_extintor, 'Dentro'),
        bi_alt_ext_sim: check(c.bi_altura_extintor_conforme),
        bi_alt_ext_nao: checkInv(c.bi_altura_extintor_conforme),
        bi_ident_sim: check(c.bi_equipamentos_identificados),
        bi_ident_nao: checkInv(c.bi_equipamentos_identificados),
        bi_nota: c.bi_parecer_texto || '',

        // CM
        cm_pcf_sim: check(c.cm_protegida_pcf),
        cm_pcf_nao: checkInv(c.cm_protegida_pcf),
        cm_nec_pcf_sim: check(c.cm_necessidade_pcf),
        cm_nec_pcf_nao: checkInv(c.cm_necessidade_pcf),
        cm_prot_ext_sim: check(c.cm_protegida_extintora),
        cm_prot_ext_nao: checkInv(c.cm_protegida_extintora),
        cm_ext_agua: checkEnum(c.cm_tipo_extintora, 'Água'),
        cm_ext_pqs:  checkEnum(c.cm_tipo_extintora, 'PQS'),
        cm_ext_co2:  checkEnum(c.cm_tipo_extintora, 'CO²'), 
        cm_loc_fora: checkEnum(c.cm_local_extintora, 'Fora'),   
        cm_loc_dentro: checkEnum(c.cm_local_extintora, 'Dentro'),
        cm_alt_ext_sim: check(c.cm_altura_conforme),
        cm_alt_ext_nao: checkInv(c.cm_altura_conforme),
        cm_ext_ident_sim: check(c.cm_extintor_identificado),
        cm_ext_ident_nao: checkInv(c.cm_extintor_identificado),
        cm_desobstruido_sim: check(c.cm_desobstruido),
        cm_desobstruido_nao: checkInv(c.cm_desobstruido),
        cm_interfone_sim: check(c.cm_interfone),
        cm_interfone_nao: checkInv(c.cm_interfone),
        cm_loc_interfone_dentro: checkEnum(c.cm_local_interfone, 'Dentro'),
        cm_loc_interfone_fora: checkEnum(c.cm_local_interfone, 'Fora'),    
        cm_det_fumaca_sim: check(c.cm_detector_fumaca),
        cm_det_fumaca_nao: checkInv(c.cm_detector_fumaca),
        cm_ilum_sim: check(c.cm_ilum_emerg),
        cm_ilum_nao: checkInv(c.cm_ilum_emerg),
        cm_ilum_func_sim: check(c.cm_ilum_emerg_funciona),
        cm_ilum_func_nao: checkInv(c.cm_ilum_emerg_funciona),
        cm_ident_sim: check(c.cm_equipamentos_identificados),
        cm_ident_nao: checkInv(c.cm_equipamentos_identificados),
        cm_nota: c.cm_parecer_texto || '',

        // AE
        ae_corrimao_cont_sim: check(c.ae_corrimão_continuo),
        ae_corrimao_cont_nao: checkInv(c.ae_corrimão_continuo),
        ae_corrimao_ambos_sim: check(c.ae_corrimão_ambos_lados),
        ae_corrimao_ambos_nao: checkInv(c.ae_corrimão_ambos_lados),
        ae_material: c.ae_material_corrimão || '',
        ae_extremidades_sim: check(c.ae_extremidades_parede),
        ae_extremidades_nao: checkInv(c.ae_extremidades_parede),
        ae_sinalizadas_sim: check(c.ae_escadarias_sinalizadas),
        ae_sinalizadas_nao: checkInv(c.ae_escadarias_sinalizadas),
        ae_tipo_ne: checkEnum(c.ae_tipo_escada, 'Reta'),  
        ae_tipo_ep: checkEnum(c.ae_tipo_escada, 'Leque'), 
        ae_fita_sim: check(c.ae_necessario_fita_antiderrapante),
        ae_fita_nao: checkInv(c.ae_necessario_fita_antiderrapante),
        ae_janelas_sim: check(c.ae_existem_janelas),
        ae_janelas_nao: checkInv(c.ae_existem_janelas),
        ae_antecamara_sim: check(c.ae_possui_antecamara),
        ae_antecamara_nao: checkInv(c.ae_possui_antecamara),
        ae_tomada_ar_sim: check(c.ae_entrada_tomada_ar_localizada),
        ae_tomada_ar_nao: checkInv(c.ae_entrada_tomada_ar_localizada),
        ae_detector_sim: check(c.ae_detector_fumaca),
        ae_detector_nao: checkInv(c.ae_detector_fumaca),
        ae_ilum_esc_sim: check(c.ae_ilum_emerg_escadarias),
        ae_ilum_esc_nao: checkInv(c.ae_ilum_emerg_escadarias),
        ae_ilum_esc_func_sim: check(c.ae_ilum_emerg_escadarias_funciona),
        ae_ilum_esc_func_nao: checkInv(c.ae_ilum_emerg_escadarias_funciona),
        ae_prever_ilum_sim: check(c.ae_ilum_emerg_escadarias_prever),
        ae_prever_ilum_nao: checkInv(c.ae_ilum_emerg_escadarias_prever),
        ae_qtd_ilum: c.ae_ilum_emerg_escadarias_quantas || '',
        ae_ilum_hall_sim: check(c.ae_ilum_emerg_halls),
        ae_ilum_hall_nao: checkInv(c.ae_ilum_emerg_halls),
        ae_ilum_hall_func_sim: check(c.ae_ilum_emerg_halls_funciona),
        ae_ilum_hall_func_nao: checkInv(c.ae_ilum_emerg_halls_funciona),
        ae_nota: c.ae_parecer_texto || '',

        // MA
        ma_escadaria: c.ma_escadaria_hall || '',
        ma_piso: c.ma_piso || '',
        ma_parede: c.ma_parede || '',
        ma_teto: c.ma_teto || '',
        ma_nota: c.ma_parecer_texto || '',

        // PCF
        pcf_existe_sim: check(c.pcf_existem_instaladas),
        pcf_existe_nao: checkInv(c.pcf_existem_instaladas),
        pcf_qtd: c.pcf_quantas || '',
        pcf_modelo_p60:  checkEnum(c.pcf_modelo, 'P60'),
        pcf_modelo_p90:  checkEnum(c.pcf_modelo, 'P90'),
        pcf_modelo_p120: checkEnum(c.pcf_modelo, 'P120'),
        pcf_modelo_ilegivel: checkEnum(c.pcf_modelo, 'Ilegível'),
        pcf_nec_inst_sim: check(c.pcf_necessidade_instalacao),
        pcf_nec_inst_nao: checkInv(c.pcf_necessidade_instalacao),
        pcf_nec_manut_sim: check(c.pcf_necessidade_manutencao),
        pcf_nec_manut_nao: checkInv(c.pcf_necessidade_manutencao),
        pcf_sin_norma_sim: check(c.pcf_sinalizada_acordo_normas),
        pcf_sin_norma_nao: checkInv(c.pcf_sinalizada_acordo_normas),
        pcf_sin_fechada_sim: check(c.pcf_sinalizadas_mantenha_fechada),
        pcf_sin_fechada_nao: checkInv(c.pcf_sinalizadas_mantenha_fechada),
        pcf_saida_sim: check(c.pcf_saida_emergencia),
        pcf_saida_nao: checkInv(c.pcf_saida_emergencia),
        pcf_nota: c.pcf_parecer_texto || '',

        // EXT
        ext_validade_sim: check(c.ext_dentro_validade),
        ext_validade_nao: checkInv(c.ext_dentro_validade),
        ext_vencimento: fmtDate(c.ext_data_vencimento),
        ext_incluir_sim: check(c.ext_necessidade_incluir_unidade),
        ext_incluir_nao: checkInv(c.ext_necessidade_incluir_unidade),
        ext_altura_sim: check(c.ext_altura_acordo_it21),
        ext_altura_nao: checkInv(c.ext_altura_acordo_it21),
        ext_pav_h2o_sim: check(c.ext_tipos_por_pavimento_h2o),
        ext_pav_h2o_nao: checkInv(c.ext_tipos_por_pavimento_h2o),
        ext_pav_pqs_sim: check(c.ext_tipos_por_pavimento_pqs),
        ext_pav_pqs_nao: checkInv(c.ext_tipos_por_pavimento_pqs),
        ext_pav_co2_sim: check(c.ext_tipos_por_pavimento_co2),
        ext_pav_co2_nao: checkInv(c.ext_tipos_por_pavimento_co2),
        ext_pav_abc_sim: check(c.ext_tipos_por_pavimento_abc),
        ext_pav_abc_nao: checkInv(c.ext_tipos_por_pavimento_abc),
        ext_sin_sim: check(c.ext_sinalizados_acordo_norma),
        ext_sin_nao: checkInv(c.ext_sinalizados_acordo_norma),
        ext_pint_piso_sim: check(c.ext_pintura_piso_subsolo),
        ext_pint_piso_nao: checkInv(c.ext_pintura_piso_subsolo),
        ext_pint_col_sim: check(c.ext_pintura_coluna_subsolo),
        ext_pint_col_nao: checkInv(c.ext_pintura_coluna_subsolo),
        ext_nota: c.ext_parecer_texto || '',

        // HID
        hid_qtd: c.hid_quantos_existem || '0',
        hid_tipo_1: checkEnum(c.hid_tipo_mangueira, '01'), 
        hid_tipo_2: checkEnum(c.hid_tipo_mangueira, '02'), 
        hid_falta_mang_sim: check(c.hid_falta_mangueira),
        hid_falta_mang_nao: checkInv(c.hid_falta_mangueira),
        hid_qtd_falta: c.hid_quantas_faltam || '',
        hid_esg_reg: checkEnum(c.hid_esguichos, 'Reguláveis'), 
        hid_esg_jat: checkEnum(c.hid_esguichos, 'Agulheta'),   
        hid_falta_esg_sim: check(c.hid_falta_esguicho),
        hid_falta_esg_nao: checkInv(c.hid_falta_esguicho),
        hid_storz_sim: check(c.hid_chave_storz_completas),
        hid_storz_nao: checkInv(c.hid_chave_storz_completas),
        hid_etiqueta_sim: check(c.hid_mangueira_etiqueta_teste),
        hid_etiqueta_nao: checkInv(c.hid_mangueira_etiqueta_teste),
        hid_vencimento: fmtDate(c.hid_vencimento_teste),
        hid_reparo_sim: check(c.hid_necessidade_reparo_substituicao),
        hid_reparo_nao: checkInv(c.hid_necessidade_reparo_substituicao),
        hid_nota: c.hid_parecer_texto || '',

        // IE
        ie_existe_sim: check(c.ie_existe_sistema),
        ie_existe_nao: checkInv(c.ie_existe_sistema),
        ie_alim_central: checkEnum(c.ie_sistema_alimentado_por, 'Baterias'),
        ie_alim_bloco:   checkEnum(c.ie_sistema_alimentado_por, 'Bloco Autônomo'),
        ie_alim_gmg:     checkEnum(c.ie_sistema_alimentado_por, 'GMG'),
        ie_funciona_sim: check(c.ie_esta_funcionando),
        ie_funciona_nao: checkInv(c.ie_esta_funcionando),
        ie_tempo: c.ie_por_quanto_tempo || '',
        ie_nota: c.ie_parecer_texto || '',

        // SH
        sh_fechados_sim: check(c.sh_estao_fechados),
        sh_fechados_nao: checkInv(c.sh_estao_fechados),
        sh_selados_sim: check(c.sh_estao_selados),
        sh_selados_nao: checkInv(c.sh_estao_selados),
        sh_nota: c.sh_parecer_texto || '',

        // SIN
        sin_existe_sim: check(c.sin_existem_sinalizacoes),
        sin_existe_nao: checkInv(c.sin_existem_sinalizacoes),
        sin_foto_sim: check(c.sin_sinalizacoes_fotoluminescentes),
        sin_foto_nao: checkInv(c.sin_sinalizacoes_fotoluminescentes),
        sin_cnpj_sim: check(c.sin_possui_cnpj_fator_luminosidade),
        sin_cnpj_nao: checkInv(c.sin_possui_cnpj_fator_luminosidade),
        sin_nota: c.sin_parecer_texto || '',

        // CA
        ca_existe_sim: check(c.ca_existe_sistema),
        ca_existe_nao: checkInv(c.ca_existe_sistema),
        ca_instalar_sim: check(c.ca_necessidade_instalar_conforme_projeto),
        ca_instalar_nao: checkInv(c.ca_necessidade_instalar_conforme_projeto),
        ca_funciona_sim: check(c.ca_teste_sistema_funcionou),
        ca_funciona_nao: checkInv(c.ca_teste_sistema_funcionou),
        ca_adeq_sim: check(c.ca_necessidade_adequacao_manutencao),
        ca_adeq_nao: checkInv(c.ca_necessidade_adequacao_manutencao),
        ca_bot_sim: check(c.ca_existe_botoeira_acionamento),
        ca_bot_nao: checkInv(c.ca_existe_botoeira_acionamento),
        ca_sin_sim: check(c.ca_estao_sinalizados),
        ca_sin_nao: checkInv(c.ca_estao_sinalizados),
        ca_sirene_sim: check(c.ca_existem_sirenes),
        ca_sirene_nao: checkInv(c.ca_existem_sirenes),
        ca_qtd_sirenes: c.ca_quantas_sirenes || '',
        ca_catraca_sim: check(c.ca_existem_catracas_eletroimas),
        ca_catraca_nao: checkInv(c.ca_existem_catracas_eletroimas),
        ca_catraca_func_sim: check(c.ca_catracas_eletroimas_funcionando),
        ca_catraca_func_nao: checkInv(c.ca_catracas_eletroimas_funcionando),
        ca_repetidor_sim: check(c.ca_necessidade_repetidor_modulos),
        ca_repetidor_nao: checkInv(c.ca_necessidade_repetidor_modulos),
        ca_nota: c.ca_parecer_texto || '',

        // RF
        rf_obs_sim: check(c.rf_existem_obstrucoes),
        rf_obs_nao: checkInv(c.rf_existem_obstrucoes),
        rf_nota: c.rf_parecer_texto || '',

        // CM_MED
        cm_med_porta: c.cm_med_tipo_porta || '',
        cm_med_extintor: c.cm_med_tipo_extintor || '',
        cm_med_sin_sim: check(c.cm_med_equipamentos_sinalizados),
        cm_med_sin_nao: checkInv(c.cm_med_equipamentos_sinalizados),
        cm_med_des_sim: check(c.cm_med_desobstruida),
        cm_med_des_nao: checkInv(c.cm_med_desobstruida),
        cm_med_ilum_sim: check(c.cm_med_possui_ilum_emerg),
        cm_med_ilum_nao: checkInv(c.cm_med_possui_ilum_emerg),
        cm_med_nota: c.cm_med_parecer_texto || '',

        // SI
        si_vig_sim: check(c.si_central_vigilancia_24h),
        si_vig_nao: checkInv(c.si_central_vigilancia_24h),
        si_local: c.si_onde_instalada_central || '',
        si_nobreak_sim: check(c.si_possui_no_break_bateria_gerador),
        si_nobreak_nao: checkInv(c.si_possui_no_break_bateria_gerador),
        si_nota: c.si_parecer_texto || '',

        // SG
        sg_encanado_sim: check(c.sg_existe_sistema_encanado),
        sg_encanado_nao: checkInv(c.sg_existe_sistema_encanado),
        sg_gn_sim: checkEnum(c.sg_qual_sistema, 'gn'),
        sg_glp_sim: checkEnum(c.sg_qual_sistema, 'glp'),
        sg_botijao_sim: check(c.sg_existem_botijoes_unidades),
        sg_botijao_nao: checkInv(c.sg_existem_botijoes_unidades),
        sg_sin_sim: check(c.sg_esta_sinalizado),
        sg_sin_nao: checkInv(c.sg_esta_sinalizado),
        sg_porta: c.sg_tipo_porta || '',
        sg_extintor: c.sg_tipo_extintor || '',
        sg_sin_porta_sim: check(c.sg_sinalizado_porta),
        sg_sin_porta_nao: checkInv(c.sg_sinalizado_porta),
        sg_placa_sim: check(c.sg_possui_placa_advertencia),
        sg_placa_nao: checkInv(c.sg_possui_placa_advertencia),
        sg_nota: c.sg_parecer_texto || '',

        // GER
        ger_existe_sim: check(c.ger_existe_sistema),
        ger_existe_nao: checkInv(c.ger_existe_sistema),
        ger_pcf_sim: check(c.ger_protegido_pcf_paredes),
        ger_pcf_nao: checkInv(c.ger_protegido_pcf_paredes),
        ger_extintor: c.ger_qual_extintor || '',
        ger_loc_cobertura: checkEnum(c.ger_onde_esta, 'Dentro'), 
        ger_loc_terreo: checkEnum(c.ger_onde_esta, 'Fora'),    
        ger_sin_sim: check(c.ger_sinalizado),
        ger_sin_nao: checkInv(c.ger_sinalizado),
        ger_dique_sim: check(c.ger_combustivel_protegido_dique),
        ger_dique_nao: checkInv(c.ger_combustivel_protegido_dique),
        ger_areas: c.ger_areas_atendidas || '',
        ger_ar_frio_sim: check(c.ger_existe_tomada_ar_frio),
        ger_ar_frio_nao: checkInv(c.ger_existe_tomada_ar_frio),
        ger_ar_quente_sim: check(c.ger_existe_saida_ar_quente),
        ger_ar_quente_nao: checkInv(c.ger_existe_saida_ar_quente),
        ger_ilum_sim: check(c.ger_possui_ilum_emerg),
        ger_ilum_nao: checkInv(c.ger_possui_ilum_emerg),
        ger_adeq_sim: check(c.ger_necessidade_adequacao_sistema),
        ger_adeq_nao: checkInv(c.ger_necessidade_adequacao_sistema),
        ger_nota: c.ger_parecer_texto || '',

        // SP
        sp_existe_sim: check(c.sp_existe_sistema),
        sp_existe_nao: checkInv(c.sp_existe_sistema),
        sp_pcf_sim: check(c.sp_protegida_pcf),
        sp_pcf_nao: checkInv(c.sp_protegida_pcf),
        sp_antecamara_sim: check(c.sp_possui_antecamara),
        sp_antecamara_nao: checkInv(c.sp_possui_antecamara),
        sp_funciona_sim: check(c.sp_sistema_funcionando),
        sp_funciona_nao: checkInv(c.sp_sistema_funcionando),
        sp_sin_sim: check(c.sp_esta_sinalizada),
        sp_sin_nao: checkInv(c.sp_esta_sinalizada),
        sp_extintor: c.sp_extintor || '',
        sp_det_sala_sim: check(c.sp_detector_sala_pressurizacao),
        sp_det_sala_nao: checkInv(c.sp_detector_sala_pressurizacao),
        sp_det_ante_sim: check(c.sp_detector_antecamara),
        sp_det_ante_nao: checkInv(c.sp_detector_antecamara),
        sp_bot_port_sim: check(c.sp_botoeira_portaria),
        sp_bot_port_nao: checkInv(c.sp_botoeira_portaria),
        sp_bot_gmv_sim: check(c.sp_botoeira_gmv),
        sp_bot_gmv_nao: checkInv(c.sp_botoeira_gmv),
        sp_reset_sim: check(c.sp_painel_reset),
        sp_reset_nao: checkInv(c.sp_painel_reset),
        sp_det_teste_sim: check(c.sp_detector_testado),
        sp_det_teste_nao: checkInv(c.sp_detector_testado),
        sp_nota: c.sp_parecer_texto || '',

        // RR
        rr_qtd: c.rr_quantidade_existente || '',
        rr_emperrado_sim: check(c.rr_esta_emperrado),
        rr_emperrado_nao: checkInv(c.rr_esta_emperrado),
        rr_pintura_sim: check(c.rr_necessidade_pintura_sinalizacao),
        rr_pintura_nao: checkInv(c.rr_necessidade_pintura_sinalizacao),
        rr_tampao_sim: check(c.rr_necessidade_tampao_2_5),
        rr_tampao_nao: checkInv(c.rr_necessidade_tampao_2_5),
        rr_adaptador_sim: check(c.rr_necessidade_adaptador_2_5),
        rr_adaptador_nao: checkInv(c.rr_necessidade_adaptador_2_5),
        rr_brita_sim: check(c.rr_possui_brita_fundo),
        rr_brita_nao: checkInv(c.rr_possui_brita_fundo),
        rr_outro_sim: check(c.rr_outro_reparo),
        rr_outro_nao: checkInv(c.rr_outro_reparo),
        rr_qual: c.rr_qual_reparo || '',
        rr_nota: c.rr_parecer_texto || '',

        // CONCLUSÃO
        conclusao_texto: c.conclusao_texto || '',
      };

      const isDesktop = navigator.userAgent.toLowerCase().includes('electron');

      if (isDesktop && (window as any).acorreaAPI?.gerarRelatorioVistoriaPrevia) {
        await (window as any).acorreaAPI.gerarRelatorioVistoriaPrevia({ vistoriaId });
      } else {
        await gerarRelatorioWeb(dadosExport);
      }
    } catch (e) { 
      alert("Erro na automação."); 
    }
  };

  const toggleSection = (sec: string) => {
    setOpenSections((prev: any) => ({ ...prev, [sec]: !prev[sec] }));
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>⚙️ Carregando dados...</div>;
  if (!vistoria || !checklist) return <div style={{ padding: '40px' }}>⚠️ Erro de dados. <button onClick={onBack}>Voltar</button></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', paddingBottom: '100px', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* HEADER FLUTUANTE */}
      <div style={headerActionStyle}>
        <button onClick={onBack} disabled={saving} style={btnBackStyle}>← Voltar</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#1a3353' }}>
          {vistoria.nome_edificacao}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => handleSave(false)} 
            disabled={saving} 
            style={saveSuccess ? { ...btnSaveStyle, backgroundColor: '#20c997' } : btnSaveStyle}
          >
            {saving ? '⏳...' : saveSuccess ? '✅ Salvo!' : '💾 Salvar'}
          </button>
          <button onClick={handleGerarRelatorio} disabled={saving} style={btnWordStyle}>
            📄 Word
          </button>
        </div>
      </div>

      <div style={{ height: '60px' }}></div>

      {/* --- SEÇÃO 1: DADOS GERAIS --- */}
      <Section title="1. Informações Gerais" isOpen={openSections.geral} onToggle={() => toggleSection('geral')}>
        <div style={gridStyle}>
            <TextRow label="Nome Edificação" value={vistoria.nome_edificacao} onChange={(v: any) => setVistoria({ ...vistoria, nome_edificacao: v })} />
            <TextRow label="Endereço" value={vistoria.endereco_edificacao} onChange={(v: any) => setVistoria({ ...vistoria, endereco_edificacao: v })} />
            <TextRow label="Pavimentos" type="number" value={vistoria.qtd_pavimentos} onChange={(v: any) => setVistoria({ ...vistoria, qtd_pavimentos: v })} />
            <TextRow label="Subsolos" type="number" value={vistoria.qtd_subsolos} onChange={(v: any) => setVistoria({ ...vistoria, qtd_subsolos: v })} />
            
            <OptionsRow 
              label="Tipo de Edificação" 
              field="tipo_edificacao" 
              value={vistoria.tipo_edificacao} 
              onChange={(_: any, v: any) => setVistoria({ ...vistoria, tipo_edificacao: v })} 
              options={[{ label: 'Residencial', value: 'Residencial' }, { label: 'Comercial', value: 'Comercial' }, { label: 'Misto', value: 'Misto' }]} 
            />

            <TextRow label="Acompanhante" value={vistoria.nome_pessoa_acompanhou} onChange={(v: any) => setVistoria({ ...vistoria, nome_pessoa_acompanhou: v })} />
            <TextRow label="Cargo" value={vistoria.cargo_pessoa_acompanhou} onChange={(v: any) => setVistoria({ ...vistoria, cargo_pessoa_acompanhou: v })} />
            <TextRow label="Telefone" value={vistoria.telefone_pessoa_acompanhou} onChange={(v: any) => setVistoria({ ...vistoria, telefone_pessoa_acompanhou: v })} />
            
            <div style={{ gridColumn: 'span 2' }}>
              <BooleanRow 
                label="Vistoria Realizada Com Projeto?" 
                value={vistoria.vistoria_com_projeto} 
                onChange={(_: any, v: any) => setVistoria({ ...vistoria, vistoria_com_projeto: v })} 
                field="vistoria_com_projeto" 
              />
            </div>
        </div>
      </Section>

      {/* --- SEÇÃO 2: BOMBA (BI) --- */}
      <Section title="2. Bomba de Incêndio" isOpen={openSections.bi} onToggle={() => toggleSection('bi')}>
        <BooleanRow label="Existe Bomba?" field="bi_existe_bomba" value={checklist.bi_existe_bomba} onChange={updateField} />
        <BooleanRow label="Protegida com PCF?" field="bi_protegida_pcf" value={checklist.bi_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Nec. Instalação PCF?" field="bi_necessidade_pcf" value={checklist.bi_necessidade_pcf} onChange={updateField} />
        <BooleanRow label="Botoeira no Barrilete?" field="bi_botoeira_barrilete" value={checklist.bi_botoeira_barrilete} onChange={updateField} />
        <BooleanRow label="Botoeira nos Pavimentos?" field="bi_botoeira_pavimentos" value={checklist.bi_botoeira_pavimentos} onChange={updateField} />
        <BooleanRow label="Teste Funcionou?" field="bi_teste_funcionou" value={checklist.bi_teste_funcionou} onChange={updateField} />
        <BooleanRow label="Existe By Pass?" field="bi_existe_bypass" value={checklist.bi_existe_bypass} onChange={updateField} />
        <BooleanRow label="Medidor Elétrico?" field="bi_medidor_eletrico" value={checklist.bi_medidor_eletrico} onChange={updateField} />
        <OptionsRow label="Tipo de Extintor" field="bi_tipo_extintor" value={checklist.bi_tipo_extintor} onChange={updateField} options={[{ label: 'Água', value: 'Água' }, { label: 'PQS', value: 'PQS' }, { label: 'CO²', value: 'CO²' }, { label: 'ABC', value: 'ABC' }]} />
        <OptionsRow label="Local do Extintor" field="bi_local_extintor" value={checklist.bi_local_extintor} onChange={updateField} options={[{ label: 'Dentro', value: 'Dentro' }, { label: 'Fora', value: 'Fora' }]} />
        <BooleanRow label="Altura/Norma?" field="bi_altura_extintor_conforme" value={checklist.bi_altura_extintor_conforme} onChange={updateField} />
        <BooleanRow label="Equip. Identificados?" field="bi_equipamentos_identificados" value={checklist.bi_equipamentos_identificados} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('bi_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.bi_parecer_texto || ''} onChange={e => updateField('bi_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 3: CASA DE MÁQUINAS (CM) --- */}
      <Section title="3. Casa de Máquinas" isOpen={openSections.cm} onToggle={() => toggleSection('cm')}>
        <BooleanRow label="Protegida por PCF?" field="cm_protegida_pcf" value={checklist.cm_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Nec. Instalação PCF?" field="cm_necessidade_pcf" value={checklist.cm_necessidade_pcf} onChange={updateField} />
        <BooleanRow label="Protegida por Extintor?" field="cm_protegida_extintora" value={checklist.cm_protegida_extintora} onChange={updateField} />
        <OptionsRow label="Tipo Extintor" field="cm_tipo_extintora" value={checklist.cm_tipo_extintora} onChange={updateField} options={[{ label: 'Água', value: 'Água' }, { label: 'PQS', value: 'PQS' }, { label: 'CO²', value: 'CO²' }]} />
        <OptionsRow label="Local Extintor" field="cm_local_extintora" value={checklist.cm_local_extintora} onChange={updateField} options={[{ label: 'Dentro', value: 'Dentro' }, { label: 'Fora', value: 'Fora' }]} />
        <BooleanRow label="Altura Conforme?" field="cm_altura_conforme" value={checklist.cm_altura_conforme} onChange={updateField} />
        <BooleanRow label="Extintor Identificado?" field="cm_extintor_identificado" value={checklist.cm_extintor_identificado} onChange={updateField} />
        <BooleanRow label="Desobstruído?" field="cm_desobstruido" value={checklist.cm_desobstruido} onChange={updateField} />
        <BooleanRow label="Interfone?" field="cm_interfone" value={checklist.cm_interfone} onChange={updateField} />
        <BooleanRow label="Detector Fumaça?" field="cm_detector_fumaca" value={checklist.cm_detector_fumaca} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="cm_ilum_emerg" value={checklist.cm_ilum_emerg} onChange={updateField} />
        <BooleanRow label="Ilum. Funciona?" field="cm_ilum_emerg_funciona" value={checklist.cm_ilum_emerg_funciona} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('cm_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.cm_parecer_texto || ''} onChange={e => updateField('cm_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 4: ESCADAS (AE) --- */}
      <Section title="4. Andares / Escadarias" isOpen={openSections.ae} onToggle={() => toggleSection('ae')}>
        <BooleanRow label="Corrimão Contínuo?" field="ae_corrimão_continuo" value={checklist.ae_corrimão_continuo} onChange={updateField} />
        <BooleanRow label="Ambos os lados?" field="ae_corrimão_ambos_lados" value={checklist.ae_corrimão_ambos_lados} onChange={updateField} />
        <TextRow label="Material" value={checklist.ae_material_corrimão} onChange={( v:any) => updateField('ae_material_corrimão', v)} field="" />
        <BooleanRow label="Extremidades Parede?" field="ae_extremidades_parede" value={checklist.ae_extremidades_parede} onChange={updateField} />
        <BooleanRow label="Sinalizadas?" field="ae_escadarias_sinalizadas" value={checklist.ae_escadarias_sinalizadas} onChange={updateField} />
        <OptionsRow label="Tipo de Escada" field="ae_tipo_escada" value={checklist.ae_tipo_escada} onChange={updateField} options={[{ label: 'Reta', value: 'Reta' }, { label: 'Leque / Caracol', value: 'Leque' }]} />
        <BooleanRow label="Nec. Fita Antiderrapante?" field="ae_necessario_fita_antiderrapante" value={checklist.ae_necessario_fita_antiderrapante} onChange={updateField} />
        <BooleanRow label="Existem Janelas?" field="ae_existem_janelas" value={checklist.ae_existem_janelas} onChange={updateField} />
        <BooleanRow label="Possui Antecâmara?" field="ae_possui_antecamara" value={checklist.ae_possui_antecamara} onChange={updateField} />
        <BooleanRow label="Detector Fumaça?" field="ae_detector_fumaca" value={checklist.ae_detector_fumaca} onChange={updateField} />
        <BooleanRow label="Ilum. Escadarias?" field="ae_ilum_emerg_escadarias" value={checklist.ae_ilum_emerg_escadarias} onChange={updateField} />
        <BooleanRow label="Ilum. Esc. Funciona?" field="ae_ilum_emerg_escadarias_funciona" value={checklist.ae_ilum_emerg_escadarias_funciona} onChange={updateField} />
        <BooleanRow label="Ilum. Halls?" field="ae_ilum_emerg_halls" value={checklist.ae_ilum_emerg_halls} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ae_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ae_parecer_texto || ''} onChange={e => updateField('ae_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 5: MATERIAIS (MA) --- */}
      <Section title="5. Materiais de Acabamento" isOpen={openSections.ma} onToggle={() => toggleSection('ma')}>
        <TextRow label="Escadaria/Hall" value={checklist.ma_escadaria_hall} onChange={( v:any) => updateField('ma_escadaria_hall', v)} field="" />
        <TextRow label="Piso" value={checklist.ma_piso} onChange={( v:any) => updateField('ma_piso', v)} field="" />
        <TextRow label="Parede" value={checklist.ma_parede} onChange={( v:any) => updateField('ma_parede', v)} field="" />
        <TextRow label="Teto" value={checklist.ma_teto} onChange={( v:any) => updateField('ma_teto', v)} field="" />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ma_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ma_parecer_texto || ''} onChange={e => updateField('ma_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 6: PCF --- */}
      <Section title="6. Porta Corta Fogo" isOpen={openSections.pcf} onToggle={() => toggleSection('pcf')}>
        <BooleanRow label="Existem instaladas?" field="pcf_existem_instaladas" value={checklist.pcf_existem_instaladas} onChange={updateField} />
        <TextRow label="Quantidade" type="number" value={checklist.pcf_quantas} onChange={( v:any) => updateField('pcf_quantas', v)} field="" />
        <OptionsRow label="Modelo" field="pcf_modelo" value={checklist.pcf_modelo} onChange={updateField} options={[{ label: 'P60', value: 'P60' }, { label: 'P90', value: 'P90' }, { label: 'P120', value: 'P120' }, { label: 'Ilegível', value: 'Ilegível' }]} />
        <BooleanRow label="Nec. Manutenção?" field="pcf_necessidade_manutencao" value={checklist.pcf_necessidade_manutencao} onChange={updateField} />
        <BooleanRow label="Sinalização Norma?" field="pcf_sinalizada_acordo_normas" value={checklist.pcf_sinalizada_acordo_normas} onChange={updateField} />
        <BooleanRow label="Sinalização 'Mantenha Fechada'?" field="pcf_sinalizadas_mantenha_fechada" value={checklist.pcf_sinalizadas_mantenha_fechada} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('pcf_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.pcf_parecer_texto || ''} onChange={e => updateField('pcf_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 7: EXTINTORES (EXT) --- */}
      <Section title="7. Extintores" isOpen={openSections.ext} onToggle={() => toggleSection('ext')}>
        <BooleanRow label="Dentro da Validade?" field="ext_dentro_validade" value={checklist.ext_dentro_validade} onChange={updateField} />
        <TextRow label="Vencimento" type="date" value={checklist.ext_data_vencimento} onChange={( v:any) => updateField('ext_data_vencimento', v)} field="" />
        <BooleanRow label="Nec. Incluir Unidade?" field="ext_necessidade_incluir_unidade" value={checklist.ext_necessidade_incluir_unidade} onChange={updateField} />
        <BooleanRow label="Altura correta (IT-21)?" field="ext_altura_acordo_it21" value={checklist.ext_altura_acordo_it21} onChange={updateField} />
        <div style={{ padding: '10px 0' }}>
          <span style={labelStyle}>Tipos por Pavimento:</span>
          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
             <label><input type="checkbox" checked={checklist.ext_tipos_por_pavimento_h2o} onChange={e => updateField('ext_tipos_por_pavimento_h2o', e.target.checked)} /> H2O</label>
             <label><input type="checkbox" checked={checklist.ext_tipos_por_pavimento_pqs} onChange={e => updateField('ext_tipos_por_pavimento_pqs', e.target.checked)} /> PQS</label>
             <label><input type="checkbox" checked={checklist.ext_tipos_por_pavimento_co2} onChange={e => updateField('ext_tipos_por_pavimento_co2', e.target.checked)} /> CO2</label>
          </div>
        </div>
        <BooleanRow label="Sinalizados Corretamente?" field="ext_sinalizados_acordo_norma" value={checklist.ext_sinalizados_acordo_norma} onChange={updateField} />
        <BooleanRow label="Pintura Piso Subsolo?" field="ext_pintura_piso_subsolo" value={checklist.ext_pintura_piso_subsolo} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ext_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ext_parecer_texto || ''} onChange={e => updateField('ext_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 8: HIDRANTES (HID) --- */}
      <Section title="8. Hidrantes" isOpen={openSections.hid} onToggle={() => toggleSection('hid')}>
        <TextRow label="Quantidade" type="number" value={checklist.hid_quantos_existem} onChange={( v:any) => updateField('hid_quantos_existem', v)} field="" />
        <OptionsRow label="Tipo Mangueira" field="hid_tipo_mangueira" value={checklist.hid_tipo_mangueira} onChange={updateField} options={[{ label: 'Tipo 01', value: '01' }, { label: 'Tipo 02', value: '02' }]} />
        <BooleanRow label="Falta Mangueira?" field="hid_falta_mangueira" value={checklist.hid_falta_mangueira} onChange={updateField} />
       <OptionsRow label="Esguichos" field="hid_esguichos" value={checklist.hid_esguichos} onChange={updateField} options={[{ label: 'Reguláveis', value: 'Reguláveis' }, { label: 'Agulheta', value: 'Agulheta' }]} />
        <BooleanRow label="Chave Storz Completa?" field="hid_chave_storz_completas" value={checklist.hid_chave_storz_completas} onChange={updateField} />
        <BooleanRow label="Mangueira c/ Etiqueta?" field="hid_mangueira_etiqueta_teste" value={checklist.hid_mangueira_etiqueta_teste} onChange={updateField} />
        <TextRow label="Vencimento Teste" type="date" value={checklist.hid_vencimento_teste} onChange={( v:any) => updateField('hid_vencimento_teste', v)} field="" />
        <BooleanRow label="Necessidade Reparo?" field="hid_necessidade_reparo_substituicao" value={checklist.hid_necessidade_reparo_substituicao} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('hid_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.hid_parecer_texto || ''} onChange={e => updateField('hid_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 9: ILUMINAÇÃO DE EMERGÊNCIA (IE) --- */}
      <Section title="9. Iluminação de Emergência" isOpen={openSections.ie} onToggle={() => toggleSection('ie')}>
        <BooleanRow label="Existe Sistema?" field="ie_existe_sistema" value={checklist.ie_existe_sistema} onChange={updateField} />
       <OptionsRow label="Alimentado Por" field="ie_sistema_alimentado_por" value={checklist.ie_sistema_alimentado_por} onChange={updateField} options={[{ label: 'Baterias (Central)', value: 'Baterias' }, { label: 'Bloco Autônomo', value: 'Bloco Autônomo' }, { label: 'GMG (Gerador)', value: 'GMG' }]} />
        <BooleanRow label="Está Funcionando?" field="ie_esta_funcionando" value={checklist.ie_esta_funcionando} onChange={updateField} />
        <TextRow label="Por quanto tempo?" value={checklist.ie_por_quanto_tempo} onChange={( v:any) => updateField('ie_por_quanto_tempo', v)} field="" />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ie_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ie_parecer_texto || ''} onChange={e => updateField('ie_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 10: SHAFTS --- */}
      <Section title="10. Shafts" isOpen={openSections.sh} onToggle={() => toggleSection('sh')}>
        <BooleanRow label="Estão fechados?" field="sh_estao_fechados" value={checklist.sh_estao_fechados} onChange={updateField} />
        <BooleanRow label="Estão selados?" field="sh_estao_selados" value={checklist.sh_estao_selados} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('sh_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.sh_parecer_texto || ''} onChange={e => updateField('sh_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 11: SINALIZAÇÃO --- */}
      <Section title="11. Sinalização" isOpen={openSections.sin} onToggle={() => toggleSection('sin')}>
        <BooleanRow label="Existem sinalizações?" field="sin_existem_sinalizacoes" value={checklist.sin_existem_sinalizacoes} onChange={updateField} />
        <BooleanRow label="São fotoluminescentes?" field="sin_sinalizacoes_fotoluminescentes" value={checklist.sin_sinalizacoes_fotoluminescentes} onChange={updateField} />
        <BooleanRow label="Possui CNPJ/Fator?" field="sin_possui_cnpj_fator_luminosidade" value={checklist.sin_possui_cnpj_fator_luminosidade} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('sin_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.sin_parecer_texto || ''} onChange={e => updateField('sin_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 12: ALARME (CA) --- */}
      <Section title="12. Central de Alarme" isOpen={openSections.ca} onToggle={() => toggleSection('ca')}>
        <BooleanRow label="Existe Sistema?" field="ca_existe_sistema" value={checklist.ca_existe_sistema} onChange={updateField} />
        <BooleanRow label="Nec. Instalar?" field="ca_necessidade_instalar_conforme_projeto" value={checklist.ca_necessidade_instalar_conforme_projeto} onChange={updateField} />
        <BooleanRow label="Teste Funcionou?" field="ca_teste_sistema_funcionou" value={checklist.ca_teste_sistema_funcionou} onChange={updateField} />
        <BooleanRow label="Nec. Adequação?" field="ca_necessidade_adequacao_manutencao" value={checklist.ca_necessidade_adequacao_manutencao} onChange={updateField} />
        <BooleanRow label="Existe Botoeira?" field="ca_existe_botoeira_acionamento" value={checklist.ca_existe_botoeira_acionamento} onChange={updateField} />
        <BooleanRow label="Estão Sinalizados?" field="ca_estao_sinalizados" value={checklist.ca_estao_sinalizados} onChange={updateField} />
        <BooleanRow label="Existem Sirenes?" field="ca_existem_sirenes" value={checklist.ca_existem_sirenes} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ca_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ca_parecer_texto || ''} onChange={e => updateField('ca_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 13: ROTA DE FUGA --- */}
      <Section title="13. Rota de Fuga" isOpen={openSections.rf} onToggle={() => toggleSection('rf')}>
        <BooleanRow label="Existem Obstruções?" field="rf_existem_obstrucoes" value={checklist.rf_existem_obstrucoes} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('rf_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.rf_parecer_texto || ''} onChange={e => updateField('rf_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 14: CENTRAL DE MEDIÇÃO --- */}
      <Section title="14. Central de Medição" isOpen={openSections.cm_med} onToggle={() => toggleSection('cm_med')}>
        <TextRow label="Tipo de Porta" value={checklist.cm_med_tipo_porta} onChange={( v:any) => updateField('cm_med_tipo_porta', v)} field="" />
        <TextRow label="Tipo de Extintor" value={checklist.cm_med_tipo_extintor} onChange={( v:any) => updateField('cm_med_tipo_extintor', v)} field="" />
        <BooleanRow label="Equip. Sinalizados?" field="cm_med_equipamentos_sinalizados" value={checklist.cm_med_equipamentos_sinalizados} onChange={updateField} />
        <BooleanRow label="Está Desobstruída?" field="cm_med_desobstruida" value={checklist.cm_med_desobstruida} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="cm_med_possui_ilum_emerg" value={checklist.cm_med_possui_ilum_emerg} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('cm_med_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.cm_med_parecer_texto || ''} onChange={e => updateField('cm_med_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 15: SISTEMAS INTEGRADOS --- */}
      <Section title="15. Interfone / Sistemas" isOpen={openSections.si} onToggle={() => toggleSection('si')}>
        <BooleanRow label="Vigilância 24h?" field="si_central_vigilancia_24h" value={checklist.si_central_vigilancia_24h} onChange={updateField} />
        <TextRow label="Local Central" value={checklist.si_onde_instalada_central} onChange={( v:any) => updateField('si_onde_instalada_central', v)} field="" />
        <BooleanRow label="Possui No-break/Gerador?" field="si_possui_no_break_bateria_gerador" value={checklist.si_possui_no_break_bateria_gerador} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('si_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.si_parecer_texto || ''} onChange={e => updateField('si_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 16: GÁS --- */}
      <Section title="16. Sistema de Gás" isOpen={openSections.sg} onToggle={() => toggleSection('sg')}>
        <BooleanRow label="Gás Encanado?" field="sg_existe_sistema_encanado" value={checklist.sg_existe_sistema_encanado} onChange={updateField} />
        <OptionsRow label="Qual Sistema?" field="sg_qual_sistema" value={checklist.sg_qual_sistema} onChange={updateField} 
          options={[{label:'Comgás', value:'Comgás'}, {label:'GLP', value:'glp'}, {label:'GNV', value:'gn'}]} />
        <BooleanRow label="Botijões nas unidades?" field="sg_existem_botijoes_unidades" value={checklist.sg_existem_botijoes_unidades} onChange={updateField} />
        <BooleanRow label="Sinalizado?" field="sg_esta_sinalizado" value={checklist.sg_esta_sinalizado} onChange={updateField} />
        <BooleanRow label="Placa Advertência?" field="sg_possui_placa_advertencia" value={checklist.sg_possui_placa_advertencia} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('sg_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.sg_parecer_texto || ''} onChange={e => updateField('sg_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 17: GERADOR --- */}
      <Section title="17. Gerador" isOpen={openSections.ger} onToggle={() => toggleSection('ger')}>
        <BooleanRow label="Existe Gerador?" field="ger_existe_sistema" value={checklist.ger_existe_sistema} onChange={updateField} />
        <BooleanRow label="Protegido PCF/Parede?" field="ger_protegido_pcf_paredes" value={checklist.ger_protegido_pcf_paredes} onChange={updateField} />
        <OptionsRow label="Localização" field="ger_onde_esta" value={checklist.ger_onde_esta} onChange={updateField} options={[{ label: 'Térreo (Fora)', value: 'Fora' }, { label: 'Cobertura/Subsolo (Dentro)', value: 'Dentro' }]} />
        <BooleanRow label="Dique de Contenção?" field="ger_combustivel_protegido_dique" value={checklist.ger_combustivel_protegido_dique} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="ger_possui_ilum_emerg" value={checklist.ger_possui_ilum_emerg} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('ger_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.ger_parecer_texto || ''} onChange={e => updateField('ger_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 18: PRESSURIZAÇÃO --- */}
      <Section title="18. Pressurização" isOpen={openSections.sp} onToggle={() => toggleSection('sp')}>
        <BooleanRow label="Existe Sistema?" field="sp_existe_sistema" value={checklist.sp_existe_sistema} onChange={updateField} />
        <BooleanRow label="Protegida PCF?" field="sp_protegida_pcf" value={checklist.sp_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Possui Antecâmara?" field="sp_possui_antecamara" value={checklist.sp_possui_antecamara} onChange={updateField} />
        <BooleanRow label="Funcionando?" field="sp_sistema_funcionando" value={checklist.sp_sistema_funcionando} onChange={updateField} />
        <BooleanRow label="Detector Sala?" field="sp_detector_sala_pressurizacao" value={checklist.sp_detector_sala_pressurizacao} onChange={updateField} />
        <BooleanRow label="Detector Antecâmara?" field="sp_detector_antecamara" value={checklist.sp_detector_antecamara} onChange={updateField} />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('sp_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.sp_parecer_texto || ''} onChange={e => updateField('sp_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- SEÇÃO 19: REGISTRO DE RECALQUE --- */}
      <Section title="19. Registro de Recalque" isOpen={openSections.rr} onToggle={() => toggleSection('rr')}>
        <TextRow label="Quantidade" type="number" value={checklist.rr_quantidade_existente} onChange={( v:any) => updateField('rr_quantidade_existente', v)} field="" />
        <BooleanRow label="Está Emperrado?" field="rr_esta_emperrado" value={checklist.rr_esta_emperrado} onChange={updateField} />
        <BooleanRow label="Nec. Pintura?" field="rr_necessidade_pintura_sinalizacao" value={checklist.rr_necessidade_pintura_sinalizacao} onChange={updateField} />
        <BooleanRow label="Nec. Tampão?" field="rr_necessidade_tampao_2_5" value={checklist.rr_necessidade_tampao_2_5} onChange={updateField} />
        <BooleanRow label="Nec. Adaptador?" field="rr_necessidade_adaptador_2_5" value={checklist.rr_necessidade_adaptador_2_5} onChange={updateField} />
        <BooleanRow label="Brita no Fundo?" field="rr_possui_brita_fundo" value={checklist.rr_possui_brita_fundo} onChange={updateField} />
        <BooleanRow label="Outro Reparo?" field="rr_outro_reparo" value={checklist.rr_outro_reparo} onChange={updateField} />
        <TextRow label="Qual Reparo?" value={checklist.rr_qual_reparo} onChange={( v:any) => updateField('rr_qual_reparo', v)} field="" />
        <div style={{ marginTop: '15px' }}>
          <label style={labelStyle}>Parecer Técnico:</label>
          <ParecerButtons onSelect={(txt: string) => appendText('rr_parecer_texto', txt)} />
          <textarea style={textareaStyle} value={checklist.rr_parecer_texto || ''} onChange={e => updateField('rr_parecer_texto', e.target.value)} />
        </div>
      </Section>

      {/* --- CONCLUSÃO --- */}
      <Section title="Conclusão Final" isOpen={openSections.conclusao} onToggle={() => toggleSection('conclusao')}>
         <div style={{ marginBottom: '10px', fontSize: '13px', color: '#666', fontWeight: '600' }}>Opções Rápidas de Conclusão:</div>
         <ConclusaoButtons onSelect={(txt: string) => appendText('conclusao_texto', txt)} />
         <textarea 
            style={{ ...textareaStyle, height: '150px' }} 
            placeholder="Conclusão geral do relatório..."
            value={checklist.conclusao_texto || ''} 
            onChange={e => updateField('conclusao_texto', e.target.value)} 
         />
      </Section>

    </div>
  );
}

// ESTILOS
const headerActionStyle: React.CSSProperties = { position: 'sticky', top: 0, left: 0, right: 0, background: 'white', borderBottom: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', zIndex: 100, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '15px' };
const radioLabelStyle = { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', background: '#f8f9fa', padding: '8px', borderRadius: '4px', border: '1px solid #eee', cursor: 'pointer', flex: '1 1 auto', justifyContent: 'center' };
const rowStyle = { marginBottom: '15px', borderBottom: '1px solid #f9f9f9', paddingBottom: '10px' };
const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '5px' };
const fullWidthInputStyle = { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' as 'border-box' };
const miniInputStyle = { width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', boxSizing: 'border-box' as 'border-box', background: '#fffef0' };
const textareaStyle = { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', fontFamily: 'inherit', fontSize: '14px', marginTop: '10px', boxSizing: 'border-box' as 'border-box' };
const btnBackStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#1a3353' };
const btnSaveStyle = { background: '#28a745', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'background-color 0.3s' };
const btnWordStyle = { background: '#1a3353', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };