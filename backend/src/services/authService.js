import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db.js';
import { createToken, hashToken } from './emailService.js';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib di-set di environment variable');
  return process.env.JWT_SECRET;
};

const googleClient = new OAuth2Client();

export function generateToken(user, rememberMe = false) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      regionId: user.regionId || null,
    },
    getJwtSecret(),
    { expiresIn: user.role === 'OWNER' && rememberMe ? '30d' : '8h' }
  );
}

export async function verifyCredentials(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();

  const users = await prisma.$queryRaw`
    SELECT "id", "name", "email", "role", "isActive", "regionId", "emailVerifiedAt",
      (crypt('123456', "passwordHash") = "passwordHash") AS "mustChangePassword"
    FROM "User"
    WHERE lower("email") = ${normalizedEmail}
      AND "isActive" = true
      AND crypt(${password}, "passwordHash") = "passwordHash"
    LIMIT 1
  `;

  if (users[0]) return users[0];
  return null;
}

export async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Google login belum dikonfigurasi.');
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) return null;
  return prisma.user.findFirst({
    where: { email: payload.email.toLowerCase(), isActive: true },
    select: { id: true, name: true, email: true, role: true, regionId: true, emailVerifiedAt: true },
  });
}

export async function changePassword(userId, newPassword) {
  const hashRows = await prisma.$queryRaw`
    SELECT crypt(${newPassword}, gen_salt('bf')) AS hash
  `;
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashRows[0].hash },
  });
}

export async function createEmailVerificationToken(userId, expiresInHours = 24) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerificationTokenHash: hashToken(token), emailVerificationExpiresAt: expiresAt },
  });
  return token;
}

export async function createPasswordResetToken(userId, expiresInHours = 1) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: expiresAt },
  });
  return token;
}

export async function consumeEmailVerificationToken(token) {
  const user = await prisma.user.findFirst({ where: { emailVerificationTokenHash: hashToken(token), emailVerificationExpiresAt: { gt: new Date() } } });
  if (!user) return null;
  return prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
  });
}

export async function consumePasswordResetToken(token, newPassword) {
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: { gt: new Date() } } });
  if (!user) return null;
  const hashRows = await prisma.$queryRaw`SELECT crypt(${newPassword}, gen_salt('bf')) AS hash`;
  return prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashRows[0].hash,
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}
