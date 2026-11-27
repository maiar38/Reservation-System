import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { Role } from './common/enums/role.enum';
import { UsersService } from './users/users.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);
  const usersService = app.get(UsersService);

  const email = configService.get<string>('SEED_ADMIN_EMAIL');
  const password = configService.get<string>('SEED_ADMIN_PASSWORD');

  if (!email || !password) {
    console.log('Add SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to .env first');
  } else if (await usersService.findByEmailWithPassword(email)) {
    console.log('Admin already exists');
  } else {
    await usersService.create({
      name: 'Admin',
      email,
      password: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
    });
    console.log('Admin created');
  }

  await app.close();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
