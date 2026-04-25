import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { SessionAccessTokenTtl } from '../config/plans';

const DEFAULT_SESSION_ACCESS_TOKEN_TTL: SessionAccessTokenTtl = '18h';
const customerAccessSecret = env.CUSTOMER_SECRET || env.JWT_SECRET;
const sessionAccessSecret = env.SESSION_SECRET || env.JWT_SECRET;

type SessionAccessTokenClaims = {
  tokenType: 'session_access';
  version: 1;
  tenantId: string;
  sessionId: string;
  customerId: string;
  tableId?: string | null;
};

type CustomerAccessClaims = {
  customerId: string;
  phone: string;
  tenantSlug?: string | null;
};

type AuthorizedSessionAccess =
  | {
      kind: 'session';
      claims: SessionAccessTokenClaims;
    }
  | {
      kind: 'customer';
      claims: CustomerAccessClaims;
    };

function readStringHeader(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function generateSessionAccessToken(payload: {
  tenantId: string;
  sessionId: string;
  customerId: string;
  tableId?: string | null;
  expiresIn?: SessionAccessTokenTtl;
}) {
  const claims: SessionAccessTokenClaims = {
    tokenType: 'session_access',
    version: 1,
    tenantId: payload.tenantId,
    sessionId: payload.sessionId,
    customerId: payload.customerId,
    tableId: payload.tableId ?? null,
  };

  return jwt.sign(claims, sessionAccessSecret, {
    expiresIn: payload.expiresIn ?? DEFAULT_SESSION_ACCESS_TOKEN_TTL,
  });
}

export function verifySessionAccessToken(token: string): SessionAccessTokenClaims {
  const decoded = jwt.verify(token, sessionAccessSecret) as Partial<SessionAccessTokenClaims>;
  if (
    decoded?.tokenType !== 'session_access' ||
    decoded?.version !== 1 ||
    typeof decoded.tenantId !== 'string' ||
    typeof decoded.sessionId !== 'string' ||
    typeof decoded.customerId !== 'string'
  ) {
    throw new Error('INVALID_SESSION_ACCESS_TOKEN');
  }

  return {
    tokenType: 'session_access',
    version: 1,
    tenantId: decoded.tenantId,
    sessionId: decoded.sessionId,
    customerId: decoded.customerId,
    tableId: typeof decoded.tableId === 'string' ? decoded.tableId : decoded.tableId ?? null,
  };
}

export function readSessionAccessToken(req: Request) {
  return (
    readStringHeader(req.header('x-session-access-token')) ||
    (typeof req.body?.sessionAccessToken === 'string' && req.body.sessionAccessToken.trim()) ||
    (typeof req.query?.sessionAccessToken === 'string' && req.query.sessionAccessToken.trim()) ||
    null
  );
}

export function readTableQrSecret(req: Request) {
  return (
    readStringHeader(req.header('x-table-qr-secret')) ||
    (typeof req.body?.qrSecret === 'string' && req.body.qrSecret.trim()) ||
    (typeof req.query?.qr === 'string' && req.query.qr.trim()) ||
    null
  );
}

export function generateCustomerAccessToken(
  payload: CustomerAccessClaims,
  expiresIn: string | number = '30d',
) {
  return jwt.sign(
    {
      customerId: payload.customerId,
      phone: payload.phone,
      tenantSlug: payload.tenantSlug ?? null,
    },
    customerAccessSecret,
    { expiresIn: expiresIn as any },
  );
}

export function verifyCustomerAccessToken(token: string): CustomerAccessClaims {
  const decoded = jwt.verify(token, customerAccessSecret) as Partial<CustomerAccessClaims>;
  if (typeof decoded?.customerId !== 'string' || typeof decoded?.phone !== 'string') {
    throw new Error('INVALID_CUSTOMER_ACCESS_TOKEN');
  }

  return {
    customerId: decoded.customerId,
    phone: decoded.phone,
    tenantSlug: typeof decoded.tenantSlug === 'string' ? decoded.tenantSlug : decoded.tenantSlug ?? null,
  };
}

export function verifyCustomerAccessTokenFromRequest(req: Request): CustomerAccessClaims | null {
  const authHeader = readStringHeader(req.header('authorization'));
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    return verifyCustomerAccessToken(token);
  } catch {
    return null;
  }
}

export function authorizeSessionAccess(
  req: Request,
  context: { tenantId: string; sessionId: string; customerId: string; tenantSlug?: string | null },
): AuthorizedSessionAccess {
  const sessionAccessToken = readSessionAccessToken(req);
  if (sessionAccessToken) {
    const claims = verifySessionAccessToken(sessionAccessToken);
    if (
      claims.tenantId !== context.tenantId ||
      claims.sessionId !== context.sessionId ||
      claims.customerId !== context.customerId
    ) {
      throw new Error('SESSION_ACCESS_MISMATCH');
    }

    return { kind: 'session', claims };
  }

  const customerClaims = verifyCustomerAccessTokenFromRequest(req);
  if (customerClaims?.customerId === context.customerId) {
    if (
      context.tenantSlug &&
      customerClaims.tenantSlug &&
      customerClaims.tenantSlug !== context.tenantSlug
    ) {
      throw new Error('SESSION_ACCESS_MISMATCH');
    }
    return { kind: 'customer', claims: customerClaims };
  }

  throw new Error('SESSION_ACCESS_REQUIRED');
}
