import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  RECIPE_GENERATOR,
  RecipeGenerator,
} from './recipe-generator.port';
import { RecipeSuggestionResponse } from './recipe-suggestion';
import { validateRecipeSuggestionRequest } from './recipe-suggestion-validator';

@Injectable()
export class RecipeSuggestionsService {
  private readonly logger = new Logger(RecipeSuggestionsService.name);

  constructor(
    @Inject(RECIPE_GENERATOR)
    private readonly generator: RecipeGenerator,
    private readonly prisma: PrismaService,
  ) {}

  async generate(input: unknown): Promise<RecipeSuggestionResponse> {
    const request = validateRecipeSuggestionRequest(input);
    const items = await this.prisma.client.expirationItem.findMany({
      where: { id: { in: request.itemIds } },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit: true,
        expirationDate: true,
      },
    });

    if (items.length !== request.itemIds.length) {
      throw new NotFoundException(
        '선택한 식재료 중 냉장고에서 찾을 수 없는 항목이 있습니다.',
      );
    }

    const order = new Map(request.itemIds.map((id, index) => [id, index]));
    const ingredients = items
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity.toString(),
        unit: item.unit,
        expirationDate: item.expirationDate?.toISOString().slice(0, 10) ?? null,
      }));

    try {
      const suggestions = await this.generator.generate({
        ingredients,
        servings: request.servings,
        maxCookingMinutes: request.maxCookingMinutes,
        assumeBasicSeasonings: request.assumeBasicSeasonings,
      });
      return { ...suggestions, generatedAt: new Date().toISOString() };
    } catch (error) {
      this.logger.error(
        'Recipe generation failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        process.env.OPENAI_API_KEY?.trim()
          ? 'AI가 레시피를 만들지 못했어요. 잠시 후 다시 시도해주세요.'
          : 'Backend의 OPENAI_API_KEY를 설정한 뒤 다시 시도해주세요.',
      );
    }
  }
}
