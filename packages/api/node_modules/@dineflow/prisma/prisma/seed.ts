import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DINEFLOW V2 demo data...\n');

  // ─── Clean existing demo data ───────────────────────────────────────────────
  await prisma.dailyAnalytics.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerSession.deleteMany();
  await prisma.table.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.staffInvite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ─── Create Demo Tenant ─────────────────────────────────────────────────────
  const tenant = await prisma.tenant.create({
    data: {
      businessName: 'The Rustic Bistro',
      slug: 'rustic-bistro',
      primaryColor: '#3B82F6',
      plan: 'STARTER',
      email: 'hello@rusticbistro.demo'
    }
  });
  console.log(`✓ Tenant created: "${tenant.businessName}" (slug: ${tenant.slug})`);

  // ─── Create Owner Account ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const owner = await prisma.user.create({
    data: {
      email: 'owner@dineflow.demo',
      passwordHash,
      name: 'Demo Owner',
      role: 'OWNER',
      tenantId: tenant.id,
    }
  });
  console.log(`✓ Owner created: ${owner.email} / demo1234`);

  // Create staff user
  const staffPassword = await bcrypt.hash('staff1234', 10);
  await prisma.user.create({
    data: {
      email: 'staff@dineflow.demo',
      passwordHash: staffPassword,
      name: 'Kitchen Staff',
      role: 'KITCHEN',
      tenantId: tenant.id,
    }
  });
  console.log(`✓ Kitchen staff created: staff@dineflow.demo / staff1234`);

  // ─── Create Menu Categories ─────────────────────────────────────────────────
  const starters = await prisma.category.create({
    data: { name: 'Starters', description: 'Light bites to begin', sortOrder: 0, tenantId: tenant.id }
  });
  const mains = await prisma.category.create({
    data: { name: 'Mains', description: 'Our signature dishes', sortOrder: 1, tenantId: tenant.id }
  });
  const drinks = await prisma.category.create({
    data: { name: 'Drinks', description: 'Refreshing beverages', sortOrder: 2, tenantId: tenant.id }
  });
  const desserts = await prisma.category.create({
    data: { name: 'Desserts', description: 'Sweet endings', sortOrder: 3, tenantId: tenant.id }
  });
  console.log(`✓ Categories created: Starters, Mains, Drinks, Desserts`);

  // ─── Create Menu Items ──────────────────────────────────────────────────────
  const burger = await prisma.menuItem.create({
    data: {
      name: 'Signature Smash Burger',
      description: 'Double smash patty, cheddar, special sauce, brioche bun',
      price: 14.99,
      sortOrder: 0,
      categoryId: mains.id,
      tenantId: tenant.id,
    }
  });

  const cookingStyle = await prisma.modifierGroup.create({
    data: {
      name: 'Cooking Style',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      menuItemId: burger.id,
      modifiers: {
        create: [
          { name: 'Rare', priceAdjustment: 0 },
          { name: 'Medium Rare', priceAdjustment: 0 },
          { name: 'Well Done', priceAdjustment: 0 },
        ]
      }
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Grilled Salmon',
      description: 'Atlantic salmon, lemon butter, seasonal greens',
      price: 22.99,
      isGlutenFree: true,
      sortOrder: 1,
      categoryId: mains.id,
      tenantId: tenant.id,
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Mushroom Risotto',
      description: 'Arborio rice, wild mushrooms, truffle oil, parmesan',
      price: 18.99,
      isVeg: true,
      sortOrder: 2,
      categoryId: mains.id,
      tenantId: tenant.id,
    }
  });

  await prisma.menuItem.create({
    data: {
      name: 'Bruschetta',
      description: 'Toasted sourdough, heirloom tomatoes, fresh basil, balsamic',
      price: 8.99,
      isVegan: true,
      sortOrder: 0,
      categoryId: starters.id,
      tenantId: tenant.id,
    }
  });

  console.log(`✓ 4 menu items created across categories`);

  // ─── Create Floor Plan ──────────────────────────────────────────────────────
  const zone = await prisma.zone.create({
    data: {
      name: 'Main Dining',
      tenantId: tenant.id,
    }
  });

  const tablePositions = [
    { name: '1', positionX: 80, positionY: 80 },   { name: '2', positionX: 230, positionY: 80 },
    { name: '3', positionX: 380, positionY: 80 },  { name: '4', positionX: 530, positionY: 80 }
  ];

  for (const t of tablePositions) {
    await prisma.table.create({
      data: { ...t, zoneId: zone.id, tenantId: tenant.id }
    });
  }
  console.log(`✓ Zone "Main Dining" created with tables`);

  // ─── Create sample completed orders for analytics ───────────────────────────
  const tables = await prisma.table.findMany({ where: { tenantId: tenant.id } });

  const sampleOrderDates = [-1, -3, -5].map(days =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  );

  for (let i = 0; i < sampleOrderDates.length; i++) {
    await prisma.order.create({
      data: {
        orderNumber: '#DEMO' + i,
        tenantId: tenant.id,
        tableId: tables[i % tables.length].id,
        status: 'COMPLETED',
        subtotal: 14.99,
        totalAmount: 14.99,
        createdAt: sampleOrderDates[i],
        items: {
          create: [
            { 
              menuItemId: burger.id, 
              name: burger.name,
              unitPrice: 14.99,
              quantity: 1,
              totalPrice: 14.99,
              selectedModifiers: '{}',
            },
          ]
        }
      }
    });
  }
  console.log(`✓ 3 sample completed orders created (for analytics)`);

  console.log('\n✅ Seed complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
