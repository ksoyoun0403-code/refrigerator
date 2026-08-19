import { Module } from '@nestjs/common';
import { ExpirationItemsController } from './expiration-items.controller';
import { ExpirationItemsService } from './expiration-items.service';

@Module({
  controllers: [ExpirationItemsController],
  providers: [ExpirationItemsService],
  exports: [ExpirationItemsService],
})
export class ExpirationItemsModule {}
