import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { SavedRecipesService } from './saved-recipes.service';

@Controller('saved-recipes')
export class SavedRecipesController {
  constructor(private readonly savedRecipesService: SavedRecipesService) {}

  @Get()
  findAll() {
    return this.savedRecipesService.findAll();
  }

  @Post()
  create(@Body() input: unknown) {
    return this.savedRecipesService.create(input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.savedRecipesService.remove(id);
  }
}
