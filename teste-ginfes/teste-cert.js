import fs from 'fs';
import https from 'https'

// 1. NOME DO SEU FICHEIRO PFX E A PALAVRA-PASSE
// Mude o nome do ficheiro se necessário e coloque a palavra-passe real
const pfxPath = './A CORREA - ARQUITETURA & SEGURANCA LTDA_53025056000167.pfx'; 
const senha = '@Ab12345'; 

async function testarConexao() {
    try {
        console.log('1. A ler o certificado do disco...');
        const certificado = fs.readFileSync(pfxPath);

        // Opções da requisição com a injeção do Certificado (mTLS)
        const options = {
            hostname: 'homologacao.ginfes.com.br',
            port: 443,
            path: '/ServiceGinfesImpl?WSDL',
            method: 'GET',
            pfx: certificado,
            passphrase: senha,
            // rejectUnauthorized a false é comum em ambientes de homologação de prefeituras 
            // porque a cadeia de certificados raiz do governo pode não estar no Node.js por padrão
            rejectUnauthorized: false 
        };

        console.log('2. A iniciar o "Handshake" seguro com o servidor Ginfes...');

        const req = https.request(options, (res) => {
            console.log(`\n--- RESPOSTA DO SERVIDOR ---`);
            console.log(`Status HTTP: ${res.statusCode}`);
            
            if (res.statusCode === 200) {
                console.log('✅ SUCESSO ABSOLUTO! A prefeitura validou o seu certificado e abriu a porta.');
            } else {
                console.log('⚠️ O servidor respondeu, mas não com sucesso total.');
            }

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Tamanho do WSDL recebido: ${data.length} bytes.`);
                console.log('Os primeiros 150 caracteres do WSDL:');
                console.log(data.substring(0, 150) + '...\n');
            });
        });

        req.on('error', (error) => {
            console.error('\n❌ FALHA NA CONEXÃO:');
            // O erro 'mac verify failure' é a forma do Node dizer que a palavra-passe do PFX está errada
            if (error.message.includes('mac verify failure')) {
                console.error('Causa: A palavra-passe do certificado PFX está incorreta.');
            } else {
                console.error(error.message);
            }
        });

        req.end();

    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error('\n❌ ERRO: O ficheiro .pfx não foi encontrado. Verifique se o nome está exato e se está na mesma pasta que este script.');
        } else {
            console.error('\n❌ ERRO DESCONHECIDO:', err.message);
        }
    }
}

testarConexao();