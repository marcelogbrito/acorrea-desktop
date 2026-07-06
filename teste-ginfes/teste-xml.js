import fs from 'fs';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

const pfxPath = './A CORREA - ARQUITETURA & SEGURANCA LTDA_53025056000167.pfx';
const senha = '@Ab12345';

function assinarNo(xmlContent, idReferencia, nomeTagAlvo, privateKeyPem, certPem) {
    const sig = new SignedXml();
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    
    sig.addReference(
        `//*[@Id='${idReferencia}']`,
        [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        "http://www.w3.org/2000/09/xmldsig#sha1"
    );

    sig.signingKey = privateKeyPem;
    sig.keyInfoProvider = {
        getKeyInfo: () => {
            const cleanCert = certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\r|\n/g, '');
            return `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`;
        }
    };

    sig.computeSignature(xmlContent, {
        location: { reference: `//*[local-name(.)='${nomeTagAlvo}']`, action: "after" }
    });

    return sig.getSignedXml();
}

async function gerarEAssinarXML() {
    console.log("1. Extraindo chaves...");
    const p12Der = fs.readFileSync(pfxPath).toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    
    const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    const cert = certBags[forge.pki.oids.certBag][0].cert;

    const privateKeyPem = forge.pki.privateKeyToPem(key);
    const certPem = forge.pki.certificateToPem(cert);

    let xmlContent = fs.readFileSync('template.xml', 'utf8').replace(/^\uFEFF/, '').trim();

    // Assinatura 1: O RPS interno
    console.log("2. Assinando o RPS...");
    let xmlAssinado = assinarNo(xmlContent, "RPS_1", "InfDeclaracaoPrestacaoServico", privateKeyPem, certPem);

    // Assinatura 2: O Lote Externo
    console.log("3. Assinando o Lote...");
    xmlAssinado = assinarNo(xmlAssinado, "LOTE_1", "LoteRps", privateKeyPem, certPem);

    fs.writeFileSync('lote_assinado.xml', xmlAssinado);
    console.log("✅ XML do Lote Assinado.");
}

gerarEAssinarXML().catch(err => console.error("ERRO:", err));