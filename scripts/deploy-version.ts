import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carrega variáveis do .env
dotenv.config();

// Tipagem simples para o package.json
interface PackageJson {
  version: string;
}

const pkg: PackageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não configuradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploy() {
  const version = pkg.version;
  const fileName = `Acorrea_Gestao_Setup_${version}.exe`;
  
  // Caminho do arquivo gerado pelo electron-builder
  // Nota: Verifique se o nome do arquivo no seu electron-builder build config bate exatamente com este
  const filePath = path.join(process.cwd(), 'dist', `Acorrea Gestao Setup ${version}.exe`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Erro: Instalador não encontrado em: ${filePath}`);
    console.log("Dica: Verifique o nome do produto no package.json ou se o build falhou.");
    process.exit(1);
  }

  console.log(`🚀 Iniciando Deploy da versão ${version}...`);

  try {
    const fileBody = fs.readFileSync(filePath);

    // 1. Upload para o Storage (Bucket 'releases')
    console.log("📤 Fazendo upload para o Supabase Storage...");
    const { data: storageData, error: storageError } = await supabase.storage
      .from('releases')
      .upload(`installers/${fileName}`, fileBody, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (storageError) throw storageError;

    // 2. Obter URL Pública
    const { data: { publicUrl } } = supabase.storage
      .from('releases')
      .getPublicUrl(`installers/${fileName}`);

    console.log('🔗 URL de Download Gerada:', publicUrl);

    // 3. Registrar nova versão no banco de dados
    console.log("💾 Registrando versão na tabela app_versions...");
    const { error: dbError } = await supabase
      .from('app_versions')
      .insert([{
        version: version,
        url: publicUrl,
        obrigatoria: false, // Por padrão opcional
        notas_versao: `Nova release estável ${version}`
      }]);

    if (dbError) throw dbError;

    console.log(`\n🎉 SUCESSO! A versão ${version} está disponível para todos os usuários.`);

  } catch (err: any) {
    console.error('\n❌ FALHA NO DEPLOY:', err.message);
    process.exit(1);
  }
}

deploy();