import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ExpirationItemsModule } from './expiration-items/expiration-items.module';
import { ExpirationScansModule } from './expiration-scans/expiration-scans.module';

@Module({
  imports: [DatabaseModule, ExpirationScansModule, ExpirationItemsModule],
  controllers: [AppController],
})
export class AppModule {}
