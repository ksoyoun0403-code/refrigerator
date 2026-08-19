import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateExpirationItem } from './expiration-item';
import { ExpirationItemsService } from './expiration-items.service';

@Controller('expiration-items')
export class ExpirationItemsController {
  constructor(private readonly itemsService: ExpirationItemsService) {}

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  create(@Body() input: CreateExpirationItem) {
    return this.itemsService.create(input);
  }
}
