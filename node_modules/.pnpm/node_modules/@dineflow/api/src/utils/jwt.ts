import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/auth';
import { UserRole } from '@dineflow/prisma';

export interface JwtPayload {
  id: string;
  tenantId: string;
  role: UserRole;
}

export const generateTokens = (payload: JwtPayload) => {
  const plainPayload = { id: payload.id, tenantId: payload.tenantId, role: payload.role };
  const accessToken = jwt.sign(plainPayload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn as any,
  });

  const refreshToken = jwt.sign(plainPayload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn as any,
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, jwtConfig.secret) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, jwtConfig.refreshSecret) as JwtPayload;
};
