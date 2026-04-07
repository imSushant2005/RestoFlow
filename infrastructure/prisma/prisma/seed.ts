import { PrismaClient, UserRole, OrderStatus, OrderType, SessionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Restoflow demo data...');

  await prisma.dailyAnalytics.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diningSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.table.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.staffInvite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      businessName: 'The Rustic Bistro',
      slug: 'rustic-bistro',
      email: 'hello@rusticbistro.demo',
      primaryColor: '#3B82F6',
      plan: 'STARTER'
    }
  });

  const ownerPasswordHash = await bcrypt.hash('demo1234', 10);
  const staffPasswordHash = await bcrypt.hash('staff1234', 10);

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Owner',
      email: 'owner@dineflow.demo',
      passwordHash: ownerPasswordHash,
      role: UserRole.OWNER
    }
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Kitchen Staff',
      email: 'staff@dineflow.demo',
      passwordHash: staffPasswordHash,
      role: UserRole.KITCHEN
    }
  });

  const starters = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Starters',
      description: 'Light bites to begin',
      sortOrder: 0
    }
  });

  const mains = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Mains',
      description: 'Signature dishes',
      sortOrder: 1
    }
  });

  await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Drinks',
      description: 'Beverages',
      sortOrder: 2
    }
  });

  const burger = await prisma.menuItem.create({
    data: {
      tenantId: tenant.id,
      categoryId: mains.id,
      name: 'Signature Smash Burger',
      description: 'Double patty, cheddar, house sauce, brioche bun',
      price: 14.99,
      images: [],
      sortOrder: 0
    }
  });

  await prisma.menuItem.create({
    data: {
      tenantId: tenant.id,
      categoryId: starters.id,
      name: 'Bruschetta',
      description: 'Toasted bread, tomatoes, basil, olive oil',
      price: 8.99,
      images: [],
      isVegan: true,
      sortOrder: 1
    }
  });

  const zone = await prisma.zone.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Dining',
      sortOrder: 0
    }
  });

  const table1 = await prisma.table.create({
    data: {
      tenantId: tenant.id,
      zoneId: zone.id,
      name: '1',
      capacity: 4,
      seats: 4,
      positionX: 80,
      positionY: 80
    }
  });

  await prisma.table.create({
    data: {
      tenantId: tenant.id,
      zoneId: zone.id,
      name: '2',
      capacity: 4,
      seats: 4,
      positionX: 230,
      positionY: 80
    }
  });

  const customer = await prisma.customer.create({
    data: {
      phone: '9999999999',
      name: 'Demo Guest'
    }
  });

  const session = await prisma.diningSession.create({
    data: {
      tenantId: tenant.id,
      tableId: table1.id,
      customerId: customer.id,
      partySize: 2,
      sessionStatus: SessionStatus.OPEN,
      source: 'qr'
    }
  });

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      tableId: table1.id,
      diningSessionId: session.id,
      orderNumber: '#DEMO-1001',
      orderType: OrderType.DINE_IN,
      status: OrderStatus.RECEIVED,
      subtotal: 14.99,
      totalAmount: 14.99,
      customerName: customer.name,
      customerPhone: customer.phone,
      completedAt: new Date()
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      menuItemId: burger.id,
      name: burger.name,
      unitPrice: 14.99,
      quantity: 1,
      totalPrice: 14.99,
      selectedModifiers: []
    }
  });

  console.log('Seed complete');
  console.log('Owner login: owner@dineflow.demo / demo1234');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
