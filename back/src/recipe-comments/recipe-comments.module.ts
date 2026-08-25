import { Module } from '@nestjs/common';
import { RecipeCommentsController } from './recipe-comments.controller';
import { RecipePostCommentsController } from './recipe-post-comments.controller';
import { RecipeCommentsService } from './recipe-comments.service';

@Module({
  controllers: [RecipePostCommentsController, RecipeCommentsController],
  providers: [RecipeCommentsService],
})
export class RecipeCommentsModule {}
