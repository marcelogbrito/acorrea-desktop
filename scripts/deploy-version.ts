import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query: string) => new Promise((resolve) => rl.question(query, resolve));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Erro: Variáveis de ambiente do Supabase não configuradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploy() {
  const version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
  const fileName = `Acorrea Gestão Setup ${version}.exe`;

  console.log(`\n📦 Preparando Release da Versão ${version}`);
  console.log(`-------------------------------------------`);
  console.log(`1. Certifique-se de que subiu o arquivo "${fileName}" para o OneDrive.`);
  
  // O script para e espera você colar o link
  const rawUrl = await question("2. Cole o link de compartilhamento do OneDrive aqui: ") as string;

  // Função interna para converter link comum em link de download direto
  const directUrl = rawUrl.replace('1drv.ms/u/', '1drv.ms/download/').replace('?usp=sharing', ''); 
  // Nota: A lógica de conversão varia conforme o tipo de link, o ideal é colar o link já direto.

  console.log(`🚀 Registrando no banco com o link: ${rawUrl}`);

  const { error } = await supabase
    .from('app_versions')
    .insert([{
      version,
      url: rawUrl,
      obrigatoria: true,
      notas_versao: `Nova versão ${version} disponível.`
    }]);

  if (error) console.error("❌ Erro:", error.message);
  else console.log("✅ Versão publicada com sucesso!");
  
  rl.close();
}

deploy();