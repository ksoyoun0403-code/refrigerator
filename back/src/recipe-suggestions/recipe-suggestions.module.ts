import { Module } from '@nestjs/common';
import { OpenAiRecipeGenerator } from './openai-recipe-generator';
import { RECIPE_GENERATOR } from './recipe-generator.port';
import { RecipeSuggestionsController } from './recipe-suggestions.controller';
import { RecipeSuggestionsService } from './recipe-suggestions.service';

@Module({
  controllers: [RecipeSuggestionsController],
  providers: [
    RecipeSuggestionsService,
    {
      provide: RECIPE_GENERATOR,
      useClass: OpenAiRecipeGenerator,
    },
  ],
})
export class RecipeSuggestionsModule {}
