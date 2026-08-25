import { Body, Controller, Delete, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  updateNickname(@CurrentUser() user: AuthenticatedUser, @Body() input: unknown) {
    return this.usersService.updateNickname(user.id, input);
  }

  @Delete('me')
  @HttpCode(204)
  removeCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(user.id);
  }
}
