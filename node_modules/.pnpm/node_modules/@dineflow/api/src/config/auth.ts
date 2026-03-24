import dotenv from 'dotenv';
dotenv.config();

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
  expiresIn: '15m',
  refreshExpiresIn: '7d',
};
