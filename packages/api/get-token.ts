import { prisma } from './src/db/prisma.js';
import { generateTokens } from './src/utils/jwt.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!user) {
    console.log("No owner found");
    return;
  }
  
  const tokens = generateTokens({
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });
  
  console.log("TOKEN:", tokens.accessToken);
}
main();
