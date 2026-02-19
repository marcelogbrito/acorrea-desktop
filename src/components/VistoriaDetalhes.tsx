import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

const TextRow = ({ label, field, value, onChange, type = "text", placeholder = "" }: any) => (
  <div style={rowStyle}>
    <label style={labelStyle}>{label}</label>
    <input 
      type={type}
      value={value || ''} 
      onChange={(e) => onChange(field, e.target.value)}
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
            checked={value === opt.value} 
            onChange={() => onChange(field, opt.value)} 
          /> {opt.label}
        </label>
      ))}
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export function VistoriaDetalhes({ vistoriaId, onBack }: any) {
  const [vistoria, setVistoria] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [openSections, setOpenSections] = useState<any>({ 
    geral: true, bi: false, cm: false, ae: false, ma: false, 
    pcf: false, ext: false, hid: false, ie: false, sh: false, 
    sin: false, ca: false, rf: false, cm_med: false, si: false, 
    sg: false, ger: false, sp: false, rr: false, conclusao: false 
  });

  useEffect(() => {
    loadData();
  }, [vistoriaId]);

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
    } catch (err: any) {
      console.error("Erro ao carregar:", err.message);
    } finally {
      setLoading(false);
    }
  }

  const updateField = (field: string, value: any) => {
    setChecklist((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      // 1. Atualiza Dados Gerais (Cabeçalho da Vistoria)
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

      // 2. Atualiza ou Cria o Checklist (UPSERT)
      const dadosChecklist = {
        ...checklist,
        vistoria_previa_id: vistoriaId 
      };
      if (!dadosChecklist.id) delete dadosChecklist.id;

      const { data: savedChecklist, error: errChecklist } = await supabase
        .from('checklist_vistoria_avcb')
        .upsert(dadosChecklist, { onConflict: 'vistoria_previa_id' })
        .select()
        .single();
      
      if (errChecklist) throw new Error("Erro ao salvar checklist: " + errChecklist.message);

      if (savedChecklist) setChecklist(savedChecklist);

      if (!silent) alert("✅ Dados salvos com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGerarRelatorio = async () => {
    await handleSave(true);
    if (!window.confirm("Gerar relatório Word agora?")) return;
    try {
      // @ts-ignore
      await window.acorreaAPI.gerarRelatorioVistoriaPrevia({ vistoriaId, tipo: 'vistoria' });
    } catch (e) { alert("Erro na automação."); }
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
        <button onClick={onBack} style={btnBackStyle}>← Voltar</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#1a3353' }}>
          {vistoria.nome_edificacao}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => handleSave(false)} disabled={saving} style={btnSaveStyle}>
            {saving ? '...' : '💾 Salvar'}
          </button>
          <button onClick={handleGerarRelatorio} style={btnWordStyle}>
            📄 Word
          </button>
        </div>
      </div>

      <div style={{ height: '60px' }}></div>

      {/* --- SEÇÃO 1: DADOS GERAIS --- */}
      <Section title="1. Informações Gerais" isOpen={openSections.geral} onToggle={() => toggleSection('geral')}>
        <div style={gridStyle}>
           <TextRow label="Nome Edificação" value={vistoria.nome_edificacao} onChange={( v:any) => setVistoria({...vistoria, nome_edificacao: v})} field="" />
           <TextRow label="Endereço" value={vistoria.endereco_edificacao} onChange={( v:any) => setVistoria({...vistoria, endereco_edificacao: v})} field="" />
           <TextRow label="Pavimentos" type="number" value={vistoria.qtd_pavimentos} onChange={( v:any) => setVistoria({...vistoria, qtd_pavimentos: v})} field="" />
           <TextRow label="Subsolos" type="number" value={vistoria.qtd_subsolos} onChange={( v:any) => setVistoria({...vistoria, qtd_subsolos: v})} field="" />
           <OptionsRow label="Tipo de Edificação" value={vistoria.tipo_edificacao} onChange={( v:any) => setVistoria({...vistoria, tipo_edificacao: v})} 
             // CORREÇÃO: Usar Maiúscula para bater com o ENUM do Banco
             options={[{label:'Residencial', value:'Residencial'}, {label:'Comercial', value:'Comercial'}, {label:'Misto', value:'Misto'}]} field="" />
           <TextRow label="Acompanhante" value={vistoria.nome_pessoa_acompanhou} onChange={( v:any) => setVistoria({...vistoria, nome_pessoa_acompanhou: v})} field="" />
           <TextRow label="Cargo" value={vistoria.cargo_pessoa_acompanhou} onChange={( v:any) => setVistoria({...vistoria, cargo_pessoa_acompanhou: v})} field="" />
           <TextRow label="Telefone" value={vistoria.telefone_pessoa_acompanhou} onChange={( v:any) => setVistoria({...vistoria, telefone_pessoa_acompanhou: v})} field="" />
           <div style={{ gridColumn: 'span 2' }}>
             <BooleanRow label="Vistoria Realizada Com Projeto?" value={vistoria.vistoria_com_projeto} onChange={( v:any) => setVistoria({...vistoria, vistoria_com_projeto: v})} field="" />
           </div>
        </div>
      </Section>

      {/* --- SEÇÃO 2: BOMBA (BI) --- */}
      <Section title="2. Bomba de Incêndio" isOpen={openSections.bi} onToggle={() => toggleSection('bi')}>
        <BooleanRow label="Existe Bomba?" field="bi_existe_bomba" value={checklist.bi_existe_bomba} onChange={updateField} />
        <BooleanRow label="Protegida com PCF?" field="bi_protegida_pcf" value={checklist.bi_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Botoeira no Barrilete?" field="bi_botoeira_barrilete" value={checklist.bi_botoeira_barrilete} onChange={updateField} />
        <BooleanRow label="Botoeira nos Pavimentos?" field="bi_botoeira_pavimentos" value={checklist.bi_botoeira_pavimentos} onChange={updateField} />
        <BooleanRow label="Teste Funcionou?" field="bi_teste_funcionou" value={checklist.bi_teste_funcionou} onChange={updateField} />
        <BooleanRow label="Existe By Pass?" field="bi_existe_bypass" value={checklist.bi_existe_bypass} onChange={updateField} />
        <BooleanRow label="Medidor Elétrico?" field="bi_medidor_eletrico" value={checklist.bi_medidor_eletrico} onChange={updateField} />
        <OptionsRow 
  label="Tipo de Extintor" 
  field="bi_tipo_extintor" 
  value={checklist.bi_tipo_extintor} 
  onChange={updateField} 
  options={[
    { label: 'Água', value: 'Água' }, 
    { label: 'PQS', value: 'PQS' }, 
    { label: 'CO²', value: 'CO²' },
    { label: 'ABC', value: 'ABC' }
  ]} 
/>
        <OptionsRow 
  label="Local do Extintor" 
  field="bi_local_extintor" 
  value={checklist.bi_local_extintor} 
  onChange={updateField} 
  options={[
    { label: 'Dentro', value: 'Dentro' }, 
    { label: 'Fora', value: 'Fora' }
  ]} 
/>
        <BooleanRow label="Altura/Norma?" field="bi_altura_extintor_conforme" value={checklist.bi_altura_extintor_conforme} onChange={updateField} />
        <BooleanRow label="Equip. Identificados?" field="bi_equipamentos_identificados" value={checklist.bi_equipamentos_identificados} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre a Bomba..." value={checklist.bi_parecer_texto || ''} onChange={e => updateField('bi_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 3: CASA DE MÁQUINAS (CM) --- */}
      <Section title="3. Casa de Máquinas" isOpen={openSections.cm} onToggle={() => toggleSection('cm')}>
        <BooleanRow label="Protegida por PCF?" field="cm_protegida_pcf" value={checklist.cm_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Nec. Instalação PCF?" field="cm_necessidade_pcf" value={checklist.cm_necessidade_pcf} onChange={updateField} />
        <BooleanRow label="Protegida por Extintor?" field="cm_protegida_extintora" value={checklist.cm_protegida_extintora} onChange={updateField} />
        <OptionsRow 
  label="Tipo Extintor" 
  field="cm_tipo_extintora" 
  value={checklist.cm_tipo_extintora} 
  onChange={updateField} 
  options={[
    { label: 'Água', value: 'Água' }, 
    { label: 'PQS', value: 'PQS' }, 
    { label: 'CO²', value: 'CO²' } // Atenção ao caractere ² sobrescrito
  ]} 
/>
      <OptionsRow 
  label="Local Extintor" 
  field="cm_local_extintora" 
  value={checklist.cm_local_extintora} 
  onChange={updateField} 
  options={[
    { label: 'Dentro', value: 'Dentro' }, 
    { label: 'Fora', value: 'Fora' }
  ]} 
/>
        <BooleanRow label="Altura Conforme?" field="cm_altura_conforme" value={checklist.cm_altura_conforme} onChange={updateField} />
        <BooleanRow label="Desobstruído?" field="cm_desobstruido" value={checklist.cm_desobstruido} onChange={updateField} />
        <BooleanRow label="Interfone?" field="cm_interfone" value={checklist.cm_interfone} onChange={updateField} />
        <BooleanRow label="Detector Fumaça?" field="cm_detector_fumaca" value={checklist.cm_detector_fumaca} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="cm_ilum_emerg" value={checklist.cm_ilum_emerg} onChange={updateField} />
        <BooleanRow label="Ilum. Funciona?" field="cm_ilum_emerg_funciona" value={checklist.cm_ilum_emerg_funciona} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Casa de Máquinas..." value={checklist.cm_parecer_texto || ''} onChange={e => updateField('cm_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 4: ESCADAS (AE) --- */}
      <Section title="4. Andares / Escadarias" isOpen={openSections.ae} onToggle={() => toggleSection('ae')}>
        <BooleanRow label="Corrimão Contínuo?" field="ae_corrimão_continuo" value={checklist.ae_corrimão_continuo} onChange={updateField} />
        <BooleanRow label="Ambos os lados?" field="ae_corrimão_ambos_lados" value={checklist.ae_corrimão_ambos_lados} onChange={updateField} />
        <TextRow label="Material" value={checklist.ae_material_corrimão} onChange={( v:any) => updateField('ae_material_corrimão', v)} field="" />
        <BooleanRow label="Extremidades Parede?" field="ae_extremidades_parede" value={checklist.ae_extremidades_parede} onChange={updateField} />
        <BooleanRow label="Sinalizadas?" field="ae_escadarias_sinalizadas" value={checklist.ae_escadarias_sinalizadas} onChange={updateField} />
        <OptionsRow 
  label="Tipo de Escada" 
  field="ae_tipo_escada" 
  value={checklist.ae_tipo_escada} 
  onChange={updateField} 
  options={[
    { label: 'Reta', value: 'Reta' }, 
    { label: 'Leque / Caracol', value: 'Leque' }
  ]} 
/>
        <BooleanRow label="Nec. Fita Antiderrapante?" field="ae_necessario_fita_antiderrapante" value={checklist.ae_necessario_fita_antiderrapante} onChange={updateField} />
        <BooleanRow label="Existem Janelas?" field="ae_existem_janelas" value={checklist.ae_existem_janelas} onChange={updateField} />
        <BooleanRow label="Possui Antecâmara?" field="ae_possui_antecamara" value={checklist.ae_possui_antecamara} onChange={updateField} />
        <BooleanRow label="Detector Fumaça?" field="ae_detector_fumaca" value={checklist.ae_detector_fumaca} onChange={updateField} />
        <BooleanRow label="Ilum. Escadarias?" field="ae_ilum_emerg_escadarias" value={checklist.ae_ilum_emerg_escadarias} onChange={updateField} />
        <BooleanRow label="Ilum. Esc. Funciona?" field="ae_ilum_emerg_escadarias_funciona" value={checklist.ae_ilum_emerg_escadarias_funciona} onChange={updateField} />
        <BooleanRow label="Ilum. Halls?" field="ae_ilum_emerg_halls" value={checklist.ae_ilum_emerg_halls} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Escadas..." value={checklist.ae_parecer_texto || ''} onChange={e => updateField('ae_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 5: MATERIAIS (MA) --- */}
      <Section title="5. Materiais de Acabamento" isOpen={openSections.ma} onToggle={() => toggleSection('ma')}>
        <TextRow label="Escadaria/Hall" value={checklist.ma_escadaria_hall} onChange={( v:any) => updateField('ma_escadaria_hall', v)} field="" />
        <TextRow label="Piso" value={checklist.ma_piso} onChange={( v:any) => updateField('ma_piso', v)} field="" />
        <TextRow label="Parede" value={checklist.ma_parede} onChange={( v:any) => updateField('ma_parede', v)} field="" />
        <TextRow label="Teto" value={checklist.ma_teto} onChange={( v:any) => updateField('ma_teto', v)} field="" />
        <textarea style={textareaStyle} placeholder="Nota sobre Materiais..." value={checklist.ma_parecer_texto || ''} onChange={e => updateField('ma_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 6: PCF --- */}
      <Section title="6. Porta Corta Fogo" isOpen={openSections.pcf} onToggle={() => toggleSection('pcf')}>
        <BooleanRow label="Existem instaladas?" field="pcf_existem_instaladas" value={checklist.pcf_existem_instaladas} onChange={updateField} />
        <TextRow label="Quantidade" type="number" value={checklist.pcf_quantas} onChange={( v:any) => updateField('pcf_quantas', v)} field="" />
        <OptionsRow 
  label="Modelo" 
  field="pcf_modelo" 
  value={checklist.pcf_modelo} 
  onChange={updateField} 
  options={[
    { label: 'P60', value: 'P60' }, 
    { label: 'P90', value: 'P90' }, 
    { label: 'P120', value: 'P120' },
    { label: 'Ilegível', value: 'Ilegível' } // Adicionado conforme sua definição no banco
  ]} 
/>
        <BooleanRow label="Nec. Manutenção?" field="pcf_necessidade_manutencao" value={checklist.pcf_necessidade_manutencao} onChange={updateField} />
        <BooleanRow label="Sinalização Norma?" field="pcf_sinalizada_acordo_normas" value={checklist.pcf_sinalizada_acordo_normas} onChange={updateField} />
        <BooleanRow label="Sinalização 'Mantenha Fechada'?" field="pcf_sinalizadas_mantenha_fechada" value={checklist.pcf_sinalizadas_mantenha_fechada} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre PCF..." value={checklist.pcf_parecer_texto || ''} onChange={e => updateField('pcf_parecer_texto', e.target.value)} />
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
        <textarea style={textareaStyle} placeholder="Nota sobre Extintores..." value={checklist.ext_parecer_texto || ''} onChange={e => updateField('ext_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 8: HIDRANTES (HID) --- */}
      <Section title="8. Hidrantes" isOpen={openSections.hid} onToggle={() => toggleSection('hid')}>
        <TextRow label="Quantidade" type="number" value={checklist.hid_quantos_existem} onChange={( v:any) => updateField('hid_quantos_existem', v)} field="" />
        <OptionsRow 
  label="Tipo Mangueira" 
  field="hid_tipo_mangueira" 
  value={checklist.hid_tipo_mangueira} 
  onChange={updateField} 
  options={[
    { label: 'Tipo 01', value: '01' }, 
    { label: 'Tipo 02', value: '02' }
  ]} 
/>
        <BooleanRow label="Falta Mangueira?" field="hid_falta_mangueira" value={checklist.hid_falta_mangueira} onChange={updateField} />
       <OptionsRow 
  label="Esguichos" 
  field="hid_esguichos" 
  value={checklist.hid_esguichos} 
  onChange={updateField} 
  options={[
    { label: 'Reguláveis', value: 'Reguláveis' }, 
    { label: 'Agulheta', value: 'Agulheta' }
  ]} 
/>
        <BooleanRow label="Chave Storz Completa?" field="hid_chave_storz_completas" value={checklist.hid_chave_storz_completas} onChange={updateField} />
        <BooleanRow label="Mangueira c/ Etiqueta?" field="hid_mangueira_etiqueta_teste" value={checklist.hid_mangueira_etiqueta_teste} onChange={updateField} />
        <TextRow label="Vencimento Teste" type="date" value={checklist.hid_vencimento_teste} onChange={( v:any) => updateField('hid_vencimento_teste', v)} field="" />
        <BooleanRow label="Necessidade Reparo?" field="hid_necessidade_reparo_substituicao" value={checklist.hid_necessidade_reparo_substituicao} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Hidrantes..." value={checklist.hid_parecer_texto || ''} onChange={e => updateField('hid_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 9: ILUMINAÇÃO DE EMERGÊNCIA (IE) --- */}
      <Section title="9. Iluminação de Emergência" isOpen={openSections.ie} onToggle={() => toggleSection('ie')}>
        <BooleanRow label="Existe Sistema?" field="ie_existe_sistema" value={checklist.ie_existe_sistema} onChange={updateField} />
       <OptionsRow 
  label="Alimentado Por" 
  field="ie_sistema_alimentado_por" 
  value={checklist.ie_sistema_alimentado_por} 
  onChange={updateField} 
  options={[
    { label: 'Baterias (Central)', value: 'Baterias' }, 
    { label: 'Bloco Autônomo', value: 'Bloco Autônomo' }, 
    { label: 'GMG (Gerador)', value: 'GMG' }
  ]} 
/>
        <BooleanRow label="Está Funcionando?" field="ie_esta_funcionando" value={checklist.ie_esta_funcionando} onChange={updateField} />
        <TextRow label="Por quanto tempo?" value={checklist.ie_por_quanto_tempo} onChange={( v:any) => updateField('ie_por_quanto_tempo', v)} field="" />
        <textarea style={textareaStyle} placeholder="Nota sobre Iluminação..." value={checklist.ie_parecer_texto || ''} onChange={e => updateField('ie_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 10: SHAFTS --- */}
      <Section title="10. Shafts" isOpen={openSections.sh} onToggle={() => toggleSection('sh')}>
        <BooleanRow label="Estão fechados?" field="sh_estao_fechados" value={checklist.sh_estao_fechados} onChange={updateField} />
        <BooleanRow label="Estão selados?" field="sh_estao_selados" value={checklist.sh_estao_selados} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Shafts..." value={checklist.sh_parecer_texto || ''} onChange={e => updateField('sh_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 11: SINALIZAÇÃO --- */}
      <Section title="11. Sinalização" isOpen={openSections.sin} onToggle={() => toggleSection('sin')}>
        <BooleanRow label="Existem sinalizações?" field="sin_existem_sinalizacoes" value={checklist.sin_existem_sinalizacoes} onChange={updateField} />
        <BooleanRow label="São fotoluminescentes?" field="sin_sinalizacoes_fotoluminescentes" value={checklist.sin_sinalizacoes_fotoluminescentes} onChange={updateField} />
        <BooleanRow label="Possui CNPJ/Fator?" field="sin_possui_cnpj_fator_luminosidade" value={checklist.sin_possui_cnpj_fator_luminosidade} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Sinalização..." value={checklist.sin_parecer_texto || ''} onChange={e => updateField('sin_parecer_texto', e.target.value)} />
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
        <textarea style={textareaStyle} placeholder="Nota sobre Alarme..." value={checklist.ca_parecer_texto || ''} onChange={e => updateField('ca_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 13: ROTA DE FUGA --- */}
      <Section title="13. Rota de Fuga" isOpen={openSections.rf} onToggle={() => toggleSection('rf')}>
        <BooleanRow label="Existem Obstruções?" field="rf_existem_obstrucoes" value={checklist.rf_existem_obstrucoes} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Rota de Fuga..." value={checklist.rf_parecer_texto || ''} onChange={e => updateField('rf_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 14: CENTRAL DE MEDIÇÃO --- */}
      <Section title="14. Central de Medição" isOpen={openSections.cm_med} onToggle={() => toggleSection('cm_med')}>
        <TextRow label="Tipo de Porta" value={checklist.cm_med_tipo_porta} onChange={( v:any) => updateField('cm_med_tipo_porta', v)} field="" />
        <TextRow label="Tipo de Extintor" value={checklist.cm_med_tipo_extintor} onChange={( v:any) => updateField('cm_med_tipo_extintor', v)} field="" />
        <BooleanRow label="Equip. Sinalizados?" field="cm_med_equipamentos_sinalizados" value={checklist.cm_med_equipamentos_sinalizados} onChange={updateField} />
        <BooleanRow label="Está Desobstruída?" field="cm_med_desobstruida" value={checklist.cm_med_desobstruida} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="cm_med_possui_ilum_emerg" value={checklist.cm_med_possui_ilum_emerg} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre C. Medição..." value={checklist.cm_med_parecer_texto || ''} onChange={e => updateField('cm_med_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 15: SISTEMAS INTEGRADOS --- */}
      <Section title="15. Interfone / Sistemas" isOpen={openSections.si} onToggle={() => toggleSection('si')}>
        <BooleanRow label="Vigilância 24h?" field="si_central_vigilancia_24h" value={checklist.si_central_vigilancia_24h} onChange={updateField} />
        <TextRow label="Local Central" value={checklist.si_onde_instalada_central} onChange={( v:any) => updateField('si_onde_instalada_central', v)} field="" />
        <BooleanRow label="Possui No-break/Gerador?" field="si_possui_no_break_bateria_gerador" value={checklist.si_possui_no_break_bateria_gerador} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Sistemas..." value={checklist.si_parecer_texto || ''} onChange={e => updateField('si_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 16: GÁS --- */}
      <Section title="16. Sistema de Gás" isOpen={openSections.sg} onToggle={() => toggleSection('sg')}>
        <BooleanRow label="Gás Encanado?" field="sg_existe_sistema_encanado" value={checklist.sg_existe_sistema_encanado} onChange={updateField} />
        <OptionsRow label="Qual Sistema?" field="sg_qual_sistema" value={checklist.sg_qual_sistema} onChange={updateField} 
          options={[{label:'Comgás', value:'Comgás'}, {label:'GLP', value:'glp'}, {label:'GNV', value:'gn'}]} />
        <BooleanRow label="Botijões nas unidades?" field="sg_existem_botijoes_unidades" value={checklist.sg_existem_botijoes_unidades} onChange={updateField} />
        <BooleanRow label="Sinalizado?" field="sg_esta_sinalizado" value={checklist.sg_esta_sinalizado} onChange={updateField} />
        <BooleanRow label="Placa Advertência?" field="sg_possui_placa_advertencia" value={checklist.sg_possui_placa_advertencia} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Gás..." value={checklist.sg_parecer_texto || ''} onChange={e => updateField('sg_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 17: GERADOR --- */}
      <Section title="17. Gerador" isOpen={openSections.ger} onToggle={() => toggleSection('ger')}>
        <BooleanRow label="Existe Gerador?" field="ger_existe_sistema" value={checklist.ger_existe_sistema} onChange={updateField} />
        <BooleanRow label="Protegido PCF/Parede?" field="ger_protegido_pcf_paredes" value={checklist.ger_protegido_pcf_paredes} onChange={updateField} />
        <OptionsRow 
  label="Localização" 
  field="ger_onde_esta" 
  value={checklist.ger_onde_esta} 
  onChange={updateField} 
  options={[
    { label: 'Térreo (Fora)', value: 'Fora' }, 
    { label: 'Cobertura/Subsolo (Dentro)', value: 'Dentro' }
  ]} 
/>
        <BooleanRow label="Dique de Contenção?" field="ger_combustivel_protegido_dique" value={checklist.ger_combustivel_protegido_dique} onChange={updateField} />
        <BooleanRow label="Ilum. Emergência?" field="ger_possui_ilum_emerg" value={checklist.ger_possui_ilum_emerg} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Gerador..." value={checklist.ger_parecer_texto || ''} onChange={e => updateField('ger_parecer_texto', e.target.value)} />
      </Section>

      {/* --- SEÇÃO 18: PRESSURIZAÇÃO --- */}
      <Section title="18. Pressurização" isOpen={openSections.sp} onToggle={() => toggleSection('sp')}>
        <BooleanRow label="Existe Sistema?" field="sp_existe_sistema" value={checklist.sp_existe_sistema} onChange={updateField} />
        <BooleanRow label="Protegida PCF?" field="sp_protegida_pcf" value={checklist.sp_protegida_pcf} onChange={updateField} />
        <BooleanRow label="Possui Antecâmara?" field="sp_possui_antecamara" value={checklist.sp_possui_antecamara} onChange={updateField} />
        <BooleanRow label="Funcionando?" field="sp_sistema_funcionando" value={checklist.sp_sistema_funcionando} onChange={updateField} />
        <BooleanRow label="Detector Sala?" field="sp_detector_sala_pressurizacao" value={checklist.sp_detector_sala_pressurizacao} onChange={updateField} />
        <BooleanRow label="Detector Antecâmara?" field="sp_detector_antecamara" value={checklist.sp_detector_antecamara} onChange={updateField} />
        <textarea style={textareaStyle} placeholder="Nota sobre Pressurização..." value={checklist.sp_parecer_texto || ''} onChange={e => updateField('sp_parecer_texto', e.target.value)} />
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
        <textarea style={textareaStyle} placeholder="Nota sobre Registro de Recalque..." value={checklist.rr_parecer_texto || ''} onChange={e => updateField('rr_parecer_texto', e.target.value)} />
      </Section>

      {/* --- CONCLUSÃO --- */}
      <Section title="Conclusão Final" isOpen={openSections.conclusao} onToggle={() => toggleSection('conclusao')}>
         <textarea 
            style={{ ...textareaStyle, height: '150px' }} 
            placeholder="Conclusão geral..."
            value={checklist.conclusao_texto || ''} 
            onChange={e => updateField('conclusao_texto', e.target.value)} 
         />
      </Section>

    </div>
  );
}

// ESTILOS
const headerActionStyle = { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, height: '60px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 100, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const rowStyle = { marginBottom: '15px', borderBottom: '1px solid #f9f9f9', paddingBottom: '10px' };
const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '5px' };
const radioLabelStyle = { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', background: '#f8f9fa', padding: '5px 10px', borderRadius: '4px', border: '1px solid #eee' };
const fullWidthInputStyle = { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' as 'border-box' };
const miniInputStyle = { width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #eee', borderRadius: '4px', marginTop: '5px', boxSizing: 'border-box' as 'border-box', background: '#fffef0' };
const textareaStyle = { width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px', fontFamily: 'inherit', fontSize: '14px', marginTop: '10px', boxSizing: 'border-box' as 'border-box' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const btnBackStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#1a3353' };
const btnSaveStyle = { background: '#28a745', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const btnWordStyle = { background: '#1a3353', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };