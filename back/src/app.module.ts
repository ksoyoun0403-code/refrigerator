import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ExpirationItemsModule } from './expiration-items/expiration-items.module';
import { ExpirationScansModule } from './expiration-scans/expiration-scans.module';
import { RecipeSuggestionsModule } from './recipe-suggestions/recipe-suggestions.module';
import { SavedRecipesModule } from './saved-recipes/saved-recipes.module';
import { AuthModule } from './auth/auth.module';
import { RecipePostsModule } from './recipe-posts/recipe-posts.module';
import { RecipeCommentsModule } from './recipe-comments/recipe-comments.module';
import { RecipeConsumptionsModule } from './recipe-consumptions/recipe-consumptions.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ExpirationScansModule,
    ExpirationItemsModule,
    RecipeSuggestionsModule,
    SavedRecipesModule,
    RecipePostsModule,
    RecipeCommentsModule,
    RecipeConsumptionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
