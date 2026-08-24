import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RecipeConsumptionsController } from './recipe-consumptions.controller';
import { RecipeConsumptionsService } from './recipe-consumptions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RecipeConsumptionsController],
  providers: [RecipeConsumptionsService],
})
export class RecipeConsumptionsModule {}
