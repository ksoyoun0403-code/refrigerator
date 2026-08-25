import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RecipeConsumptionsService } from './recipe-consumptions.service';

@Controller('recipe-consumptions')
@UseGuards(AuthGuard)
export class RecipeConsumptionsController {
  constructor(private readonly service: RecipeConsumptionsService) {}

  @Post('preview')
  @HttpCode(200)
  preview(@CurrentUser() user: AuthenticatedUser, @Body() input: unknown) {
    return this.service.preview(user.id, input);
  }

  @Post()
  consume(@CurrentUser() user: AuthenticatedUser, @Body() input: unknown) {
    return this.service.consume(user.id, input);
  }
}
