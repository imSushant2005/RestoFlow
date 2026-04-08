import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'super-secret-key-change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-me',
  expiresIn: '15m',
  refreshExpiresIn: '7d',
};
