import { isValidIndonesianPhone } from './phoneUtils.js';

export function validateContactMessage(form) {
  const errors = {};
  const name = String(form.name || '').trim();
  const phone = String(form.phone || '').trim();
  const message = String(form.message || '').trim();

  if (!name) errors.name = 'Nama wajib diisi.';
  else if (name.length < 2) errors.name = 'Nama minimal 2 karakter.';
  else if (name.length > 100) errors.name = 'Nama maksimal 100 karakter.';

  if (phone.length > 30) errors.phone = 'Nomor WhatsApp maksimal 30 karakter.';
  else if (phone && !isValidIndonesianPhone(phone)) {
    errors.phone = 'Masukkan nomor WhatsApp Indonesia yang valid, misalnya 0812 3456 7890.';
  }

  if (!message) errors.message = 'Pesan wajib diisi.';
  else if (message.length < 3) errors.message = 'Pesan minimal 3 karakter.';
  else if (message.length > 2000) errors.message = 'Pesan maksimal 2.000 karakter.';

  return errors;
}
