import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../src/config/db.js';
import { consumeEmailVerificationToken, createEmailVerificationToken, verifyCredentials } from '../src/services/authService.js';

const savedNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = savedNodeEnv;

const email = `phase1-test-${Date.now()}@example.invalid`;
const user = await prisma.user.create({
  data: { name: 'Phase 1 Test', email, passwordHash: 'disabled', role: 'CASHIER' },
});
let server;

try {
  const token = await createEmailVerificationToken(user.id);
  const verified = await consumeEmailVerificationToken(token);
  assert.equal(verified.id, user.id);
  assert.equal(await consumeEmailVerificationToken(token), null, 'Token verifikasi harus sekali pakai');

  const expiredToken = await createEmailVerificationToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerificationExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await consumeEmailVerificationToken(expiredToken), null, 'Token kedaluwarsa harus ditolak');

  server = http.createServer(app);
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

  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const productionResponse = await fetch(`http://127.0.0.1:${port}/api/auth/development-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword: 'GlosirTest#84', passwordConfirmation: 'GlosirTest#84' }),
    });
    assert.equal(productionResponse.status, 404, 'Reset langsung harus ditutup di production');

    process.env.NODE_ENV = 'development';
    const directResetResponse = await fetch(`http://127.0.0.1:${port}/api/auth/development-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword: 'GlosirTest#84', passwordConfirmation: 'GlosirTest#84' }),
    });
    const directResetBody = await directResetResponse.json();
    assert.equal(directResetResponse.status, 200);
    assert.equal(directResetBody.success, true);
    assert.equal((await verifyCredentials(email, 'GlosirTest#84')).id, user.id);

    const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'GlosirTest#84' }),
    });
    const loginBody = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    assert.equal(loginBody.user.id, user.id);

    const changePasswordResponse = await fetch(`http://127.0.0.1:${port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginBody.token}`,
      },
      body: JSON.stringify({ newPassword: 'GlosirAgain#95', passwordConfirmation: 'GlosirAgain#95' }),
    });
    const changePasswordBody = await changePasswordResponse.json();
    assert.equal(changePasswordResponse.status, 200);
    assert.ok(changePasswordBody.token);

    const sessionResponse = await fetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${changePasswordBody.token}` },
    });
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionBody.user.id, user.id);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }

  console.log('Phase 1 email auth checks passed.');
} finally {
  if (server?.listening) {
    const serverClosed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await serverClosed;
  }
  try {
    await prisma.auditLog.deleteMany({ where: { changedById: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  } finally {
    await prisma.$disconnect();
  }
}
