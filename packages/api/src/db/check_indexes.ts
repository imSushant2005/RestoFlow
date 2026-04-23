import { PrismaClient } from '@bhojflow/prisma';
const p = new PrismaClient();
p.$queryRawUnsafe(`
  SELECT indexname, tablename FROM pg_indexes 
  WHERE tablename IN ('Order','Customer','DiningSession','Bill','OrderAuditLog','OrderItem')
  ORDER BY tablename, indexname
`).then((r: any) => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); });
