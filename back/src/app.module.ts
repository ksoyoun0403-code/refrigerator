import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ExpirationItemsModule } from './expiration-items/expiration-items.module';
import { ExpirationScansModule } from './expiration-scans/expiration-scans.module';

@Module({
  imports: [ExpirationScansModule, ExpirationItemsModule],
  controllers: [AppController],
})
export class AppModule {}
