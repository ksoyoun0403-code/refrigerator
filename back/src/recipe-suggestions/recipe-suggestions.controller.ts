import { Body, Controller, Post } from '@nestjs/common';
import { RecipeSuggestionsService } from './recipe-suggestions.service';

@Controller('recipe-suggestions')
export class RecipeSuggestionsController {
  constructor(private readonly suggestionsService: RecipeSuggestionsService) {}

  @Post()
  generate(@Body() input: unknown) {
    return this.suggestionsService.generate(input);
  }
}
