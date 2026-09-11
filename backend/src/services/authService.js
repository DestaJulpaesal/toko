import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib di-set di environment variable');
  return process.env.JWT_SECRET;
};

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      regionId: user.regionId || null,
    },
    getJwtSecret(),
    { expiresIn: '8h' }
  );
}

export async function verifyCredentials(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();

  const users = await prisma.$queryRaw`
    SELECT "id", "name", "email", "role", "isActive", "regionId"
    FROM "User"
    WHERE lower("email") = ${normalizedEmail}
      AND "isActive" = true
      AND crypt(${password}, "passwordHash") = "passwordHash"
    LIMIT 1
  `;

  if (users[0]) return users[0];
  return null;
}
