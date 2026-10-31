import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '../models/User';

const SALT_ROUNDS = 10;

export interface JwtPayload {
  id: string;
  rol: Role;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no está definido en .env');
  return secret;
}

export function generateJWT(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, getSecret(), { expiresIn });
}

export function verifyJWT(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded === 'string' || !decoded.id) throw new jwt.JsonWebTokenError('Token mal formado');
  return { id: String(decoded.id), rol: decoded.rol as Role };
}
