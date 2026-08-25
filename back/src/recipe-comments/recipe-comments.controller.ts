import { Body, Controller, Delete, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { RecipeCommentsService } from './recipe-comments.service';

@Controller('recipe-comments')
@UseGuards(AuthGuard)
export class RecipeCommentsController {
  constructor(private readonly commentsService: RecipeCommentsService) {}

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: unknown) {
    return this.commentsService.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.commentsService.remove(user.id, user.loginId, id);
  }
}
