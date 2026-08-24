import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RecipeSuggestionsService } from './recipe-suggestions.service';

@Controller('recipe-suggestions')
@UseGuards(AuthGuard)
export class RecipeSuggestionsController {
  constructor(private readonly suggestionsService: RecipeSuggestionsService) {}

  @Post()
  generate(@CurrentUser() user: AuthenticatedUser, @Body() input: unknown) {
    return this.suggestionsService.generate(user.id, input);
  }
}
