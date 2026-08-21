import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ExpirationItemsModule } from './expiration-items/expiration-items.module';
import { ExpirationScansModule } from './expiration-scans/expiration-scans.module';
import { RecipeSuggestionsModule } from './recipe-suggestions/recipe-suggestions.module';
import { SavedRecipesModule } from './saved-recipes/saved-recipes.module';

@Module({
  imports: [
    DatabaseModule,
    ExpirationScansModule,
    ExpirationItemsModule,
    RecipeSuggestionsModule,
    SavedRecipesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
