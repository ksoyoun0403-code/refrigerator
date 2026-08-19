import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('v1');
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  console.log(`mydish backend is running on http://localhost:${port}`);
}

void bootstrap();
