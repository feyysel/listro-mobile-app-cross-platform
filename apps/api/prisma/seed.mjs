import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function scrypt(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derived) => {
      if (error || !derived) reject(error ?? new Error('Key derivation failed'));
      else resolve(derived);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

async function ensureUser({ email, firstName, lastName, phone, role, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { role, status: 'ACTIVE', firstName, lastName, phone },
    });
  }
  return prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      phone,
      role,
      status: 'ACTIVE',
      passwordHash: await hashPassword(password),
    },
  });
}

async function ensureCustomer(user) {
  const existing = await prisma.customer.findUnique({ where: { userId: user.id } });
  return existing ?? prisma.customer.create({ data: { userId: user.id } });
}

async function ensureEmployee(user, employeeCode) {
  const existing = await prisma.employee.findUnique({ where: { userId: user.id } });
  if (existing) return existing;
  return prisma.employee.create({
    data: { userId: user.id, employeeCode, status: 'ACTIVE' },
  });
}

async function ensureService(name, description, duration) {
  const existing = await prisma.service.findFirst({ where: { name } });
  return existing ?? prisma.service.create({ data: { name, description, estimatedDurationMinutes: duration } });
}

async function main() {
  const admin = await ensureUser({
    email: 'admin@listro.test',
    firstName: 'Aster',
    lastName: 'Admin',
    phone: '+251911000001',
    role: 'ADMIN',
    password: 'Admin@12345',
  });
  const manager = await ensureUser({
    email: 'manager@listro.test',
    firstName: 'Mekdes',
    lastName: 'Manager',
    phone: '+251911000002',
    role: 'MANAGER',
    password: 'Manager@123',
  });
  const operator = await ensureUser({
    email: 'operator@listro.test',
    firstName: 'Nahom',
    lastName: 'Operator',
    phone: '+251911000003',
    role: 'OPERATOR',
    password: 'Operator@123',
  });
  const delivery = await ensureUser({
    email: 'delivery@listro.test',
    firstName: 'Fikru',
    lastName: 'Driver',
    phone: '+251911000004',
    role: 'DELIVERY',
    password: 'Delivery@123',
  });
  const customerUser = await ensureUser({
    email: 'customer@listro.test',
    firstName: 'Selam',
    lastName: 'Tesfaye',
    phone: '+251911000005',
    role: 'CUSTOMER',
    password: 'Customer@123',
  });

  const customer = await ensureCustomer(customerUser);
  const managerEmployee = await ensureEmployee(manager, 'EMP-MGR-001');
  const operatorEmployee = await ensureEmployee(operator, 'EMP-OPS-001');
  const deliveryEmployee = await ensureEmployee(delivery, 'EMP-DEL-001');
  const adminEmployee = await ensureEmployee(admin, 'EMP-ADM-001');

  const branch = await prisma.branch.upsert({
    where: { code: 'ADDIS-01' },
    update: {},
    create: {
      name: 'Listro Bole Cleaning Center',
      code: 'ADDIS-01',
      address: 'Bole Road, near Medhanialem',
      city: 'Addis Ababa',
      subCity: 'Bole',
      woreda: '03',
      phone: '+251112345678',
      email: 'bole@listro.test',
      status: 'ACTIVE',
      latitude: 8.9928,
      longitude: 38.7955,
    },
  });

  for (const employee of [managerEmployee, operatorEmployee, deliveryEmployee, adminEmployee]) {
    await prisma.branchEmployee.upsert({
      where: { branchId_employeeId: { branchId: branch.id, employeeId: employee.id } },
      update: {},
      create: { branchId: branch.id, employeeId: employee.id },
    });
  }

  const serviceSpecs = [
    ['Basic Cleaning', 'Interior, exterior and laces refresh', 45],
    ['Deep Cleaning', 'Detailed cleaning, stain treatment and deodorizing', 90],
    ['Sneaker Restoration', 'Midsole refresh and material conditioning', 120],
    ['Leather Care', 'Leather conditioning and polish', 75],
  ];
  const prices = [350, 650, 900, 1200];
  const services = [];
  for (let index = 0; index < serviceSpecs.length; index += 1) {
    const [name, description, duration] = serviceSpecs[index];
    const service = await ensureService(name, description, duration);
    await prisma.branchService.upsert({
      where: { branchId_serviceId: { branchId: branch.id, serviceId: service.id } },
      update: { price: prices[index], isActive: true },
      create: { branchId: branch.id, serviceId: service.id, price: prices[index] },
    });
    services.push({ service, price: prices[index] });
  }

  let address = await prisma.address.findFirst({ where: { customerId: customer.id, isDefault: true } });
  if (!address) {
    address = await prisma.address.create({
      data: {
        customerId: customer.id,
        label: 'Home',
        recipientName: 'Selam Tesfaye',
        phone: '+251911000005',
        addressLine: 'Bole Michael, behind Friendship Square',
        city: 'Addis Ababa',
        subCity: 'Bole',
        woreda: '03',
        houseNumber: 'B-24',
        landmark: 'Friendship Square',
        isDefault: true,
        latitude: 8.9916,
        longitude: 38.7874,
      },
    });
  }

  if ((await prisma.shoe.count({ where: { customerId: customer.id } })) === 0) {
    await prisma.shoe.createMany({
      data: [
        { customerId: customer.id, brand: 'Nike', model: 'Air Force 1', category: 'Sneakers', color: 'White' },
        { customerId: customer.id, brand: 'Clarks', model: 'Desert Boot', category: 'Boots', color: 'Sand' },
      ],
    });
  }

  const orderSpecs = [
    {
      code: 'LST-2026-0001',
      status: 'PLACED',
      serviceIndex: 0,
      count: 1,
      daysAgo: 0,
      notes: 'Please call before pickup.',
    },
    {
      code: 'LST-2026-0002',
      status: 'CONFIRMED',
      serviceIndex: 1,
      count: 1,
      daysAgo: 1,
      notes: 'Stain on left toe box.',
    },
    {
      code: 'LST-2026-0003',
      status: 'WASHING_IN_PROGRESS',
      serviceIndex: 2,
      count: 2,
      daysAgo: 2,
      notes: 'Need careful treatment.',
    },
    {
      code: 'LST-2026-0004',
      status: 'READY_FOR_DELIVERY',
      serviceIndex: 3,
      count: 1,
      daysAgo: 3,
      notes: '',
    },
    {
      code: 'LST-2026-0005',
      status: 'DELIVERED',
      serviceIndex: 1,
      count: 1,
      daysAgo: 6,
      notes: '',
    },
  ];

  for (const spec of orderSpecs) {
    const existing = await prisma.order.findUnique({ where: { bookingCode: spec.code } });
    if (existing) continue;

    const chosen = services[spec.serviceIndex];
    const branchService = await prisma.branchService.findUniqueOrThrow({
      where: { branchId_serviceId: { branchId: branch.id, serviceId: chosen.service.id } },
    });
    const total = chosen.price * spec.count;
    const placedAt = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000);
    const order = await prisma.order.create({
      data: {
        bookingCode: spec.code,
        customerId: customer.id,
        branchId: branch.id,
        pickupAddressId: address.id,
        returnAddressId: address.id,
        status: spec.status,
        subtotal: total,
        totalAmount: total,
        placedAt,
        customerNotes: spec.notes || null,
      },
    });

    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        branchServiceId: branchService.id,
        serviceName: chosen.service.name,
        unitPrice: chosen.price,
        quantity: spec.count,
        totalPrice: total,
        shoeCategory: spec.serviceIndex === 3 ? 'Leather shoes' : 'Sneakers',
        shoeBrand: spec.serviceIndex === 3 ? 'Clarks' : 'Nike',
        conditionNotes: spec.notes || null,
      },
    });

    const workflowStatuses = [
      'PLACED',
      'CONFIRMED',
      'DELIVERY_ASSIGNED',
      'PICKUP_IN_PROGRESS',
      'RECEIVED_AT_CENTER',
      'WASHING_IN_PROGRESS',
      'WASHING_COMPLETED',
      'READY_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const currentIndex = workflowStatuses.indexOf(spec.status);
    for (let index = 0; index <= currentIndex; index += 1) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: index === 0 ? null : workflowStatuses[index - 1],
          newStatus: workflowStatuses[index],
          changedByUserId: index === 0 ? customerUser.id : manager.id,
          note: index === 0 ? 'Order placed by customer' : null,
          createdAt: new Date(placedAt.getTime() + index * 60 * 60 * 1000),
        },
      });
    }

    if (currentIndex >= 2) {
      await prisma.delivery.create({
        data: {
          orderId: order.id,
          branchId: branch.id,
          addressId: address.id,
          employeeId: deliveryEmployee.id,
          type: 'PICKUP',
          status: currentIndex >= 4 ? 'COMPLETED' : currentIndex >= 3 ? 'IN_PROGRESS' : 'ASSIGNED',
          scheduledAt: placedAt,
          assignedAt: placedAt,
        },
      });
    }

    if (currentIndex >= 7) {
      await prisma.washingTask.create({
        data: {
          orderId: order.id,
          orderItemId: item.id,
          branchId: branch.id,
          operatorId: operatorEmployee.id,
          status: currentIndex >= 8 ? 'COMPLETED' : 'IN_PROGRESS',
          startedAt: placedAt,
        },
      });
      await prisma.shoeInspection.create({
        data: {
          orderItemId: item.id,
          inspectorId: operatorEmployee.id,
          conditionBefore: 'Good condition with light wear',
          conditionAfter: 'Clean and conditioned',
        },
      });
    }

    if (currentIndex >= 8) {
      await prisma.delivery.create({
        data: {
          orderId: order.id,
          branchId: branch.id,
          addressId: address.id,
          employeeId: deliveryEmployee.id,
          type: 'RETURN',
          status: currentIndex >= 9 ? 'COMPLETED' : 'ASSIGNED',
          scheduledAt: placedAt,
          assignedAt: placedAt,
        },
      });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          recordedByUserId: manager.id,
          amount: total,
          method: 'TELEBIRR',
          status: 'COMPLETED',
          provider: 'TELEBIRR',
          transactionReference: `${spec.code}-PAY`,
          paidAt: placedAt,
        },
      });
    }
  }

  if ((await prisma.notification.count({ where: { userId: customerUser.id } })) === 0) {
    await prisma.notification.create({
      data: {
        userId: customerUser.id,
        title: 'Welcome to Listro',
        message: 'Your demo account is ready. Place a shoe cleaning order to get started.',
        type: 'welcome',
        data: { demo: true },
      },
    });
  }

  console.log('Seed complete.');
  console.log('Demo logins: admin@listro.test / Admin@12345, manager@listro.test / Manager@123, operator@listro.test / Operator@123, delivery@listro.test / Delivery@123, customer@listro.test / Customer@123');
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
