import { prisma } from './src/db/prisma';

async function main() {
  const users = await prisma.user.findMany({ include: { tenant: true } });
  console.log('Total users:', users.length);
  for (const user of users) {
    console.log(`User: ${user.email}, Role: ${user.role}, Tenant: ${user.tenant.businessName}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
