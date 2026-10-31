import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  villageZone: string;
  phoneNumber?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

// In-memory token revocation cache with TTL
const revokedTokens = new Map<string, number>();

// Clean up expired revoked tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of revokedTokens.entries()) {
    if (expiry <= now) {
      revokedTokens.delete(token);
    }
  }
}, 15 * 60 * 1000).unref();

export function revokeToken(token: string, expiryMs = 7 * 24 * 60 * 60 * 1000): void {
  revokedTokens.set(token, Date.now() + expiryMs);
}

export function isTokenRevoked(token: string): boolean {
  const expiry = revokedTokens.get(token);
  if (!expiry) return false;
  if (expiry <= Date.now()) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
}

export function isSupervisor(role: string): boolean {
  const normalized = (role || '').trim().toLowerCase();
  return (
    normalized.includes('supervisor') ||
    normalized.includes('admin') ||
    normalized === 'healthcare supervisor'
  );
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing or malformed authentication token',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Token missing',
    });
    return;
  }

  if (isTokenRevoked(token)) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Token has been revoked. Please log in again.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      role: string;
      villageZone: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        villageZone: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: User account no longer exists',
      });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      villageZone: user.villageZone,
      phoneNumber: user.phoneNumber,
    };
    req.token = token;

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Session token has expired. Please log in again.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid authentication token',
    });
    return;
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      return;
    }

    const userRole = (req.user.role || '').toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to perform this action',
      });
      return;
    }

    next();
  };
}
