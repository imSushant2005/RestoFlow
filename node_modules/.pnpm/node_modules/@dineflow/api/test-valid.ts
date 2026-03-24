import { prisma } from './src/db/prisma.js';
import { generateTokens } from './src/utils/jwt.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!user) {
    console.log("No owner found");
    return;
  }
  
  const zone = await prisma.zone.findFirst({ where: { tenantId: user.tenantId } });
  if (!zone) {
    console.log("No zone found");
    return;
  }
  
  const tokens = generateTokens({
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });
  
  const res = await fetch('http://localhost:4000/venue/tables', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + tokens.accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'T100-Valid', zoneId: zone.id, x: 50, y: 50 })
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
}
main();
