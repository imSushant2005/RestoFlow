import { prisma } from './src/db/prisma.js';
import { generateTokens } from './src/utils/jwt.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!user) return console.log("No owner found");
  
  const tokens = generateTokens({
    id: user.id, tenantId: user.tenantId, role: user.role,
  });
  
  console.log("Fetching zones...");
  const res = await fetch('http://localhost:4000/venue/zones', {
    headers: { 'Authorization': 'Bearer ' + tokens.accessToken }
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body length:', text.length);
}
main();
