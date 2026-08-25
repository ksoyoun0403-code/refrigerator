import { Module } from '@nestjs/common';
import { RecipePostsController } from './recipe-posts.controller';
import { RecipePostsService } from './recipe-posts.service';

@Module({
  controllers: [RecipePostsController],
  providers: [RecipePostsService],
})
export class RecipePostsModule {}
