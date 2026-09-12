export async function sendWhatsappMessage(phoneNumber, message) {
  const apiKey = process.env.FONNTE_API_KEY;
  const target = phoneNumber || process.env.OWNER_WHATSAPP_NUMBER;
  if (!apiKey || !target) {
    console.warn('WhatsApp recap skipped: FONNTE_API_KEY or OWNER_WHATSAPP_NUMBER is not configured.');
    return { sent: false, skipped: true };
  }

  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === false) throw new Error(data.reason || 'WhatsApp provider rejected the message');
  return { sent: true, data };
}
