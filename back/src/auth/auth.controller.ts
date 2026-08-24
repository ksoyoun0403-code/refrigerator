import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: unknown) {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() input: unknown) {
    return this.authService.login(input);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() input: unknown) {
    return this.authService.refresh(input);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body() input: unknown) {
    return this.authService.logout(input);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Patch('password')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: unknown,
  ) {
    return this.authService.changePassword(user.id, input);
  }
}
