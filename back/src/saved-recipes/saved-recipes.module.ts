import { Module } from '@nestjs/common';
import { SavedRecipesController } from './saved-recipes.controller';
import { SavedRecipesService } from './saved-recipes.service';

@Module({
  controllers: [SavedRecipesController],
  providers: [SavedRecipesService],
})
export class SavedRecipesModule {}
