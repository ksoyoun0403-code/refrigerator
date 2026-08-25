import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateExpirationItem, UpdateExpirationItem } from './expiration-item';
import { ExpirationItemsService } from './expiration-items.service';

@Controller('expiration-items')
@UseGuards(AuthGuard)
export class ExpirationItemsController {
  constructor(private readonly itemsService: ExpirationItemsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.itemsService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateExpirationItem) {
    return this.itemsService.create(user.id, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateExpirationItem,
  ) {
    return this.itemsService.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.itemsService.remove(user.id, id);
  }
}
