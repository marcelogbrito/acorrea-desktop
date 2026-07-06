import fs from 'fs';
import https from 'https';

const pfxPath = './A CORREA - ARQUITETURA & SEGURANCA LTDA_53025056000167.pfx';
const senha = '@Ab12345';

async function enviarLote() {
    console.log("1. Lendo o XML assinado...");
    // Adicione este replace ao ler o arquivo assinado
let xmlAssinado = fs.readFileSync('lote_assinado.xml', 'utf8').replace(/^\uFEFF/, '').trim();

// Remova a declaração XML do xmlAssinado
const xmlLimpo = xmlAssinado.replace(/<\?xml.*\?>/g, '').trim();

// Monta o envelope SOAP com o namespace correto na tag de requisição
const soapEnvelope = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <nfse:RecepcionarLoteRpsRequest xmlns:nfse="http://nfse.abrasf.org.br">
      <nfseCabecMsg><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cabecalho versao="2.04" xmlns="http://www.giss.com.br/cabecalho-v2_04.xsd"><versaoDados>2.04</versaoDados></cabecalho>]]></nfseCabecMsg>
      <nfseDadosMsg><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlLimpo}]]></nfseDadosMsg>
    </nfse:RecepcionarLoteRpsRequest>
  </soap:Body>
</soap:Envelope>`;

    const certificado = fs.readFileSync(pfxPath);

    const options = {
    hostname: 'ws-homologacao-rtc.giss.com.br',
    port: 443,
    path: '/service-ws/nf/nfse-ws', 
    method: 'POST',
    pfx: certificado,
    passphrase: senha,
    rejectUnauthorized: false,
    headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://nfse.abrasf.org.br/RecepcionarLoteRps',
        'Content-Length': Buffer.byteLength(soapEnvelope)
    }
};

    console.log("2. Enviando para a Prefeitura...");
    
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`\nStatus HTTP: ${res.statusCode}`);
            console.log("\n--- RESPOSTA DA PREFEITURA ---");
            console.log(data);
        });
    });

    req.on('error', (e) => console.error("Erro no envio:", e));
    req.write(soapEnvelope);
    req.end();
}

enviarLote();