import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';

export async function gerarLaudoWorker(
  dadosTemplate: any, 
  caminhoTemplate: string, 
  caminhoSaida: string
) {
  const content = fs.readFileSync(caminhoTemplate, 'binary');
  const zip = new PizZip(content);
  
  const doc = new Docxtemplater(zip, { 
    paragraphLoop: true, 
    linebreaks: true 
  });

  try {
    doc.render(dadosTemplate);
  } catch (error: any) {
    throw new Error(`Erro na renderização do Laudo Word: ${JSON.stringify(error)}`);
  }

  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  fs.writeFileSync(caminhoSaida, buf);

  return caminhoSaida;
}