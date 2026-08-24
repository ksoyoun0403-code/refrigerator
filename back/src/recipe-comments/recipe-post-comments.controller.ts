import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RecipeCommentsService } from './recipe-comments.service';

@Controller('recipe-posts/:recipePostId/comments')
@UseGuards(AuthGuard)
export class RecipePostCommentsController {
  constructor(private readonly commentsService: RecipeCommentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Param('recipePostId') recipePostId: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.commentsService.findAll(user.id, recipePostId, cursor, limit);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Param('recipePostId') recipePostId: string, @Body() input: unknown) {
    return this.commentsService.create(user.id, recipePostId, input);
  }
}
