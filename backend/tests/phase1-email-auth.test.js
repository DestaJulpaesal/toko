import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/config/db.js';
import app from '../src/app.js';
import { consumeEmailVerificationToken, createEmailVerificationToken } from '../src/services/authService.js';

const email = `phase1-test-${Date.now()}@example.invalid`;
const user = await prisma.user.create({
  data: { name: 'Phase 1 Test', email, passwordHash: 'disabled', role: 'CASHIER' },
});

try {
  const token = await createEmailVerificationToken(user.id);
  const verified = await consumeEmailVerificationToken(token);
  assert.equal(verified.id, user.id);
  assert.equal(await consumeEmailVerificationToken(token), null, 'Token verifikasi harus sekali pakai');

  const expiredToken = await createEmailVerificationToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerificationExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await consumeEmailVerificationToken(expiredToken), null, 'Token kedaluwarsa harus ditolak');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tidak-terdaftar@example.invalid' }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.message, 'Jika email terdaftar, tautan reset password sudah dikirim.');
  await new Promise((resolve) => server.close(resolve));
  console.log('Phase 1 email auth checks passed.');
} finally {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
