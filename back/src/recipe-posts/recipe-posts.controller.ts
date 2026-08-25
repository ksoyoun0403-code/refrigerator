import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RecipePostsService } from './recipe-posts.service';

@Controller('recipe-posts')
@UseGuards(AuthGuard)
export class RecipePostsController {
  constructor(private readonly recipePostsService: RecipePostsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query?: string,
    @Query('sort') sort?: string,
  ) {
    return this.recipePostsService.findAll(user.id, query, sort);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query('q') query?: string) {
    return this.recipePostsService.findMine(user.id, query);
  }

  @Get('bookmarked')
  findBookmarked(@CurrentUser() user: AuthenticatedUser, @Query('q') query?: string) {
    return this.recipePostsService.findBookmarked(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recipePostsService.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: unknown) {
    return this.recipePostsService.create(user.id, input);
  }

  @Post(':id/bookmark')
  bookmark(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recipePostsService.bookmark(user.id, id);
  }

  @Delete(':id/bookmark')
  @HttpCode(204)
  removeBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.recipePostsService.removeBookmark(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recipePostsService.remove(user.id, id);
  }
}
