import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react'; // npm install qrcode.react

export function ConfiguracoesWhatsApp() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'desconectado' | 'conectando' | 'pronto'>('desconectado');

  useEffect(() => {
    // @ts-ignore
    const unsubQR = window.acorreaAPI.onWhatsAppQR((qr: string) => {
      setQrCode(qr);
      setStatus('conectando');
    });

    // Escuta também os logs de status que já criamos no main.ts
    // @ts-ignore
    const unsubLog = window.acorreaAPI.onInboxLog((msg: string) => {
      if (msg.includes('✅')) setStatus('pronto');
    });

    return () => {
      unsubQR();
      unsubLog();
    };
  }, []);

  return (
    <section style={cardStyle}>
      <h3>📱 Conexão WhatsApp</h3>
      <p style={{ fontSize: '13px', color: '#666' }}>
        Conecte o WhatsApp da Acorrea para centralizar o atendimento.
      </p>

      <div style={statusBadgeStyle(status)}>
        {status === 'desconectado' && '⚪ Aguardando Inicialização...'}
        {status === 'conectando' && '🟡 Escaneie o QR Code abaixo'}
        {status === 'pronto' && '🟢 WhatsApp Conectado e Ativo'}
      </div>

      <div style={qrContainerStyle}>
        {status === 'pronto' ? (
          <div style={{ textAlign: 'center', color: '#28a745' }}>
            <span style={{ fontSize: '50px' }}>✅</span>
            <p>Dispositivo Pareado</p>
          </div>
        ) : qrCode ? (
          <QRCodeSVG value={qrCode} size={200} />
        ) : (
          <div style={skeletonStyle}>Gerando QR Code...</div>
        )}
      </div>
      
      <p style={avisoStyle}>
        Dica: Abra o WhatsApp no seu celular {'>'} Aparelhos conectados {'>'} Conectar um aparelho.
      </p>
    </section>
  );
}

// Estilos
const cardStyle = { padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' };
const qrContainerStyle = { display: 'flex', justifyContent: 'center', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', margin: '20px 0' };
const statusBadgeStyle = (status: string) => ({
  padding: '8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 'bold' as 'bold',
  backgroundColor: status === 'pronto' ? '#d4edda' : status === 'conectando' ? '#fff3cd' : '#eee',
  color: status === 'pronto' ? '#155724' : status === 'conectando' ? '#856404' : '#666',
  textAlign: 'center' as 'center'
});
const skeletonStyle = { width: '200px', height: '200px', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#999' };
const avisoStyle = { fontSize: '11px', color: '#999', fontStyle: 'italic' };