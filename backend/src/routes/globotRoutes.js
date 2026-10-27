import express from 'express';
import { z } from 'zod';
import prisma from '../config/db.js';
import { globotLimiter, validateBody } from '../middleware/security.js';
import { createGlobotHandler } from '../services/globotService.js';

const router = express.Router();

const messageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    content: z.string().trim().min(1).max(1200),
  }).strict(),
  z.object({
    role: z.literal('assistant'),
    content: z.string().trim().min(1).max(2500),
  }).strict(),
]);

export const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(12).refine(
    (messages) => messages[messages.length - 1]?.role === 'user',
    'Pesan terakhir harus berasal dari pelanggan.',
  ),
  context: z.object({
    path: z.string().trim().max(180).default('/'),
    title: z.string().trim().max(180).default(''),
    productId: z.string().trim().max(100).nullable().optional(),
    cart: z.array(z.object({
      name: z.string().max(160),
      quantity: z.number().int().min(1).max(100),
    }).strict()).max(8).default([]),
  }).strict().default({}),
}).strict();

router.post(
  '/chat',
  globotLimiter,
  validateBody(chatSchema),
  createGlobotHandler({ db: prisma }),
);

export default router;
