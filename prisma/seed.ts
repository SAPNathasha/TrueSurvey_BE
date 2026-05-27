import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: {
      email: 'test@gmail.com',
    },
    update: {
      password: hashedPassword,
      fullName: 'Test User',
      role: 'PARTICIPANT',
    },
    create: {
      email: 'test@gmail.com',
      password: hashedPassword,
      fullName: 'Test User',
      role: 'PARTICIPANT',
    },
  });

  console.log('Test user created successfully:', user.email);
}

main()
  .catch((error: unknown) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
