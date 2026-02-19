import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Funções Auxiliares de Formatação (Tolerantes a null/undefined)
const X = '(X)';
const O = '( )';

// Se valor for true marca X, qualquer outra coisa (null/undefined/false) marca ( )
const check = (val: any) => (val === true ? X : O);

// Se valor for false marca X (para perguntas negativas), null/undefined marca ( )
const checkInv = (val: any) => (val === false ? X : O);

// Compara strings de forma segura
const checkEnum = (val: any, expected: string) => (val === expected ? X : O);

// Formata data ISO para DD/MM/AAAA de forma segura
const fmtDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '___/___/_____';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch (e) {
    return '___/___/_____';
  }
};

// Formata string segura (se for null, retorna vazio para não quebrar o toUpperCase)
const safeStr = (str: string | null | undefined) => (str ? str.toUpperCase() : '');

export async function gerarRelatorioVistoriaPrevia(
  vistoriaId: string, 
  caminhoTemplate: string, 
  caminhoSaida: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Busca Completa
  const { data: v, error } = await supabase
    .from('vistoria_previa_avcb')
    .select('*, checklist_vistoria_avcb(*)')
    .eq('id', vistoriaId)
    .single();

  if (error || !v) throw new Error(`Vistoria não encontrada: ${error?.message}`);

  // --- CORREÇÃO CRÍTICA AQUI ---
  // Tratamos o checklist: se vier array, pega o primeiro. Se vier null, usa objeto vazio {}.
  let rawChecklist = v.checklist_vistoria_avcb;
  if (Array.isArray(rawChecklist)) rawChecklist = rawChecklist[0];
  
  // O 'c' agora é garantido como objeto. Se o campo não existir, retorna 'undefined' em vez de erro.
  const c = rawChecklist || {}; 

  // 2. Mapeamento Massivo (SQL -> Tags do Word)
  const dados = {
    // --- DADOS GERAIS (Usa safeStr para evitar erro de toUpperCase em null) ---
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
    vistoriador: 'Rafael Corrêa',

    // --- BOMBA DE INCÊNDIO (BI) ---
    // Como 'c' é {}, acessar c.bi_existe_bomba retorna undefined, que o check() trata como ( )
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

    // --- CASA DE MÁQUINAS (CM) ---
    cm_pcf_sim: check(c.cm_protegida_pcf),
    cm_pcf_nao: checkInv(c.cm_protegida_pcf),
    cm_nec_pcf_sim: check(c.cm_necessidade_pcf),
    cm_nec_pcf_nao: checkInv(c.cm_necessidade_pcf),
    cm_prot_ext_sim: check(c.cm_protegida_extintora),
    cm_prot_ext_nao: checkInv(c.cm_protegida_extintora),
    cm_ext_agua: checkEnum(c.cm_tipo_extintora, 'Água'),
cm_ext_pqs:  checkEnum(c.cm_tipo_extintora, 'PQS'),
cm_ext_co2:  checkEnum(c.cm_tipo_extintora, 'CO²'), // Deve bater com o valor do banco
    cm_loc_fora: checkEnum(c.cm_local_extintora, 'Fora'),   // Antes era 'fora'
cm_loc_dentro: checkEnum(c.cm_local_extintora, 'Dentro'), // Antes era 'dentro'
    cm_alt_ext_sim: check(c.cm_altura_conforme),
    cm_alt_ext_nao: checkInv(c.cm_altura_conforme),
    cm_ext_ident_sim: check(c.cm_extintor_identificado),
    cm_ext_ident_nao: checkInv(c.cm_extintor_identificado),
    cm_desobstruido_sim: check(c.cm_desobstruido),
    cm_desobstruido_nao: checkInv(c.cm_desobstruido),
    cm_interfone_sim: check(c.cm_interfone),
    cm_interfone_nao: checkInv(c.cm_interfone),
    cm_loc_interfone_dentro: checkEnum(c.cm_local_interfone, 'Dentro'), // Antes era 'dentro'
cm_loc_interfone_fora: checkEnum(c.cm_local_interfone, 'Fora'),     // Antes era 'fora'
    cm_det_fumaca_sim: check(c.cm_detector_fumaca),
    cm_det_fumaca_nao: checkInv(c.cm_detector_fumaca),
    cm_ilum_sim: check(c.cm_ilum_emerg),
    cm_ilum_nao: checkInv(c.cm_ilum_emerg),
    cm_ilum_func_sim: check(c.cm_ilum_emerg_funciona),
    cm_ilum_func_nao: checkInv(c.cm_ilum_emerg_funciona),
    cm_ident_sim: check(c.cm_equipamentos_identificados),
    cm_ident_nao: checkInv(c.cm_equipamentos_identificados),
    cm_nota: c.cm_parecer_texto || '',

    // --- ACESSO E ESCADAS (AE) ---
    ae_corrimao_cont_sim: check(c.ae_corrimão_continuo),
    ae_corrimao_cont_nao: checkInv(c.ae_corrimão_continuo),
    ae_corrimao_ambos_sim: check(c.ae_corrimão_ambos_lados),
    ae_corrimao_ambos_nao: checkInv(c.ae_corrimão_ambos_lados),
    ae_material: c.ae_material_corrimão || '',
    ae_extremidades_sim: check(c.ae_extremidades_parede),
    ae_extremidades_nao: checkInv(c.ae_extremidades_parede),
    ae_sinalizadas_sim: check(c.ae_escadarias_sinalizadas),
    ae_sinalizadas_nao: checkInv(c.ae_escadarias_sinalizadas),
    ae_tipo_ne: checkEnum(c.ae_tipo_escada, 'Reta'),  // Se for Reta no banco, marca a tag ae_tipo_ne
ae_tipo_ep: checkEnum(c.ae_tipo_escada, 'Leque'), // Se for Leque no banco, marca a tag ae_tipo_ep
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

    // --- MATERIAIS DE ACABAMENTO (MA) ---
    ma_escadaria: c.ma_escadaria_hall || '',
    ma_piso: c.ma_piso || '',
    ma_parede: c.ma_parede || '',
    ma_teto: c.ma_teto || '',
    ma_nota: c.ma_parecer_texto || '',

    // --- PORTAS CORTA FOGO (PCF) ---
    pcf_existe_sim: check(c.pcf_existem_instaladas),
    pcf_existe_nao: checkInv(c.pcf_existem_instaladas),
    pcf_qtd: c.pcf_quantas || '',
    pcf_modelo_p60:  checkEnum(c.pcf_modelo, 'P60'),
pcf_modelo_p90:  checkEnum(c.pcf_modelo, 'P90'),
pcf_modelo_p120: checkEnum(c.pcf_modelo, 'P120'),
// Se quiser adicionar a tag de ilegível no Word, use:
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

    // --- EXTINTORES (EXT) ---
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

    // --- HIDRANTES (HID) ---
    hid_qtd: c.hid_quantos_existem || '0',
    hid_tipo_1: checkEnum(c.hid_tipo_mangueira, '01'), // Antes era 'tipo1'
hid_tipo_2: checkEnum(c.hid_tipo_mangueira, '02'), // Antes era 'tipo2'
    hid_falta_mang_sim: check(c.hid_falta_mangueira),
    hid_falta_mang_nao: checkInv(c.hid_falta_mangueira),
    hid_qtd_falta: c.hid_quantas_faltam || '',
   hid_esg_reg: checkEnum(c.hid_esguichos, 'Reguláveis'), // Antes era 'regulavel'
hid_esg_jat: checkEnum(c.hid_esguichos, 'Agulheta'),   // Antes era 'jato_solido'
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

    // --- ILUMINAÇÃO DE EMERGÊNCIA (IE) ---
    ie_existe_sim: check(c.ie_existe_sistema),
    ie_existe_nao: checkInv(c.ie_existe_sistema),
    ie_alim_central: checkEnum(c.ie_sistema_alimentado_por, 'Baterias'),
ie_alim_bloco:   checkEnum(c.ie_sistema_alimentado_por, 'Bloco Autônomo'),
ie_alim_gmg:     checkEnum(c.ie_sistema_alimentado_por, 'GMG'),
    ie_funciona_sim: check(c.ie_esta_funcionando),
    ie_funciona_nao: checkInv(c.ie_esta_funcionando),
    ie_tempo: c.ie_por_quanto_tempo || '',
    ie_nota: c.ie_parecer_texto || '',

    // --- SHAFTS (SH) ---
    sh_fechados_sim: check(c.sh_estao_fechados),
    sh_fechados_nao: checkInv(c.sh_estao_fechados),
    sh_selados_sim: check(c.sh_estao_selados),
    sh_selados_nao: checkInv(c.sh_estao_selados),
    sh_nota: c.sh_parecer_texto || '',

    // --- SINALIZAÇÃO (SIN) ---
    sin_existe_sim: check(c.sin_existem_sinalizacoes),
    sin_existe_nao: checkInv(c.sin_existem_sinalizacoes),
    sin_foto_sim: check(c.sin_sinalizacoes_fotoluminescentes),
    sin_foto_nao: checkInv(c.sin_sinalizacoes_fotoluminescentes),
    sin_cnpj_sim: check(c.sin_possui_cnpj_fator_luminosidade),
    sin_cnpj_nao: checkInv(c.sin_possui_cnpj_fator_luminosidade),
    sin_nota: c.sin_parecer_texto || '',

    // --- ALARME DE INCÊNDIO (CA) ---
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

    // --- ROTA DE FUGA (RF) ---
    rf_obs_sim: check(c.rf_existem_obstrucoes),
    rf_obs_nao: checkInv(c.rf_existem_obstrucoes),
    rf_nota: c.rf_parecer_texto || '',

    // --- CENTRO DE MEDIÇÃO (CM_MED) ---
    cm_med_porta: c.cm_med_tipo_porta || '',
    cm_med_extintor: c.cm_med_tipo_extintor || '',
    cm_med_sin_sim: check(c.cm_med_equipamentos_sinalizados),
    cm_med_sin_nao: checkInv(c.cm_med_equipamentos_sinalizados),
    cm_med_des_sim: check(c.cm_med_desobstruida),
    cm_med_des_nao: checkInv(c.cm_med_desobstruida),
    cm_med_ilum_sim: check(c.cm_med_possui_ilum_emerg),
    cm_med_ilum_nao: checkInv(c.cm_med_possui_ilum_emerg),
    cm_med_nota: c.cm_med_parecer_texto || '',

    // --- SISTEMAS INTEGRADOS (SI) ---
    si_vig_sim: check(c.si_central_vigilancia_24h),
    si_vig_nao: checkInv(c.si_central_vigilancia_24h),
    si_local: c.si_onde_instalada_central || '',
    si_nobreak_sim: check(c.si_possui_no_break_bateria_gerador),
    si_nobreak_nao: checkInv(c.si_possui_no_break_bateria_gerador),
    si_nota: c.si_parecer_texto || '',

    // --- SISTEMA DE GÁS (SG) ---
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

    // --- GERADOR (GER) ---
    ger_existe_sim: check(c.ger_existe_sistema),
    ger_existe_nao: checkInv(c.ger_existe_sistema),
    ger_pcf_sim: check(c.ger_protegido_pcf_paredes),
    ger_pcf_nao: checkInv(c.ger_protegido_pcf_paredes),
    ger_extintor: c.ger_qual_extintor || '',
    ger_loc_cobertura: checkEnum(c.ger_onde_esta, 'Dentro'), // Dentro mapeia para Cobertura/ Subsolo no modelo
ger_loc_terreo: checkEnum(c.ger_onde_esta, 'Fora'),    // Fora mapeia para Térreo no modelo
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

    // --- SISTEMA DE PRESSURIZAÇÃO (SP) ---
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

    // --- REGISTRO DE RECALQUE (RR) ---
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

    // --- CONCLUSÃO ---
    conclusao_texto: c.conclusao_texto || '',
  };

  // 3. Renderização
  const content = fs.readFileSync(caminhoTemplate, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
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