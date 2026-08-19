import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateExpirationItem, UpdateExpirationItem } from './expiration-item';
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateExpirationItem) {
    return this.itemsService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.itemsService.remove(id);
  }
}
