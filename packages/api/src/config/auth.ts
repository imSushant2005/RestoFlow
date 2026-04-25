import { env } from './env';

export const jwtConfig = {
  secret: env.STAFF_ACCESS_SECRET || env.JWT_SECRET,
  refreshSecret:
    env.STAFF_REFRESH_SECRET || env.JWT_REFRESH_SECRET || env.STAFF_ACCESS_SECRET || env.JWT_SECRET,
  expiresIn: '24h',
  refreshExpiresIn: '7d',
};
