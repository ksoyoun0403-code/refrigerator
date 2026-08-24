import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { validateSavedRecipeInput } from '../saved-recipes/saved-recipes.service';

type Unit = 'COUNT' | 'G' | 'KG' | 'ML' | 'L' | 'PACK' | 'BAG' | 'BOTTLE' | 'CAN';
type InventoryRecord = {
  id: string;
  name: string;
  quantity: { toString(): string };
  unit: Unit;
  expirationDate: Date | null;
};

const QUANTITY_PATTERN = /^\d{1,6}(?:\.\d{1,3})?$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const UNITS: Unit[] = ['COUNT', 'G', 'KG', 'ML', 'L', 'PACK', 'BAG', 'BOTTLE', 'CAN'];
const UNIT_ALIASES: Array<[RegExp, Unit]> = [
  [/^(?:개|ea)$/i, 'COUNT'], [/^kg$/i, 'KG'], [/^g$/i, 'G'],
  [/^(?:ml|mL)$/i, 'ML'], [/^l$/i, 'L'], [/^팩$/, 'PACK'],
  [/^봉$/, 'BAG'], [/^병$/, 'BOTTLE'], [/^캔$/, 'CAN'],
];

@Injectable()
export class RecipeConsumptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(userId: string, input: unknown) {
    const recipe = validateSavedRecipeInput(input);
    const inventory = await this.prisma.client.expirationItem.findMany({
      where: { userId },
      orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { purchasedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, quantity: true, unit: true, expirationDate: true },
    });

    return {
      recipeTitle: recipe.title,
      lines: recipe.usedIngredients.map((ingredient, index) =>
        this.previewLine(index, ingredient.name, ingredient.amount, inventory as InventoryRecord[]),
      ),
    };
  }

  async consume(userId: string, input: unknown) {
    const parsed = parseConsumption(input);
    const existing = await this.prisma.client.recipeConsumption.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: parsed.idempotencyKey } },
    });
    if (existing) return existing.result;

    try {
      return await this.prisma.client.$transaction(async (transaction) => {
        const updatedItems: Array<{ id: string; name: string; quantity: string; unit: Unit; removed: boolean }> = [];
        for (const deduction of parsed.deductions) {
          const current = await transaction.expirationItem.findFirst({
            where: { id: deduction.itemId, userId },
            select: { id: true, scanId: true, name: true, quantity: true, unit: true },
          });
          if (!current) throw new BadRequestException('차감할 냉장고 재료를 찾을 수 없습니다.');
          const currentQuantity = Number(current.quantity.toString());
          let remaining: number;
          let resultingUnit = current.unit as Unit;
          if (deduction.mode === 'DEDUCT') {
            if (deduction.quantity > currentQuantity) {
              throw new ConflictException(`${current.name}의 냉장고 수량이 부족합니다.`);
            }
            remaining = roundQuantity(currentQuantity - deduction.quantity);
          } else {
            remaining = deduction.remainingQuantity;
            resultingUnit = deduction.unit;
            if (resultingUnit === current.unit && remaining > currentQuantity) {
              throw new ConflictException(`${current.name}의 남은 양은 현재 수량보다 클 수 없습니다.`);
            }
          }
          if (remaining === 0) {
            await transaction.expirationItem.delete({ where: { id: current.id } });
            await transaction.expirationScan.delete({ where: { id: current.scanId } });
          } else {
            await transaction.expirationItem.update({ where: { id: current.id }, data: { quantity: String(remaining), unit: resultingUnit } });
          }
          updatedItems.push({ id: current.id, name: current.name, quantity: String(remaining), unit: resultingUnit, removed: remaining === 0 });
        }
        const result = { recipeTitle: parsed.recipeTitle, updatedItems };
        await transaction.recipeConsumption.create({
          data: { userId, idempotencyKey: parsed.idempotencyKey, result },
        });
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const completed = await this.prisma.client.recipeConsumption.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: parsed.idempotencyKey } },
        });
        if (completed) return completed.result;
      }
      throw error;
    }
  }

  private previewLine(index: number, ingredientName: string, recipeAmount: string, inventory: InventoryRecord[]) {
    const sameName = inventory.filter((item) => normalizeName(item.name) === normalizeName(ingredientName));
    const manualItems = sameName.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      currentQuantity: item.quantity.toString(),
      unit: item.unit,
      expirationDate: item.expirationDate?.toISOString().slice(0, 10) ?? null,
    }));
    const parsedAmount = parseRecipeAmount(recipeAmount);
    if (!parsedAmount) {
      return { id: String(index), ingredientName, recipeAmount, status: 'UNSUPPORTED' as const, manualItems, message: manualItems.length ? '자동 환산할 수 없어 요리 후 남은 양을 직접 입력해주세요.' : '사용량을 확인할 수 없고 냉장고에서 같은 이름의 재료도 찾지 못했습니다.' };
    }
    const compatible = sameName.filter((item) => convertQuantity(parsedAmount.quantity, parsedAmount.unit, item.unit) !== undefined);
    const item = compatible[0];
    if (!item) {
      return { id: String(index), ingredientName, recipeAmount, status: sameName.length ? 'INCOMPATIBLE_UNIT' as const : 'NOT_FOUND' as const, manualItems, message: sameName.length ? '냉장고 단위와 자동 환산할 수 없어 남은 양을 직접 입력해주세요.' : '냉장고에서 같은 이름의 재료를 찾지 못했습니다.' };
    }
    const suggestedQuantity = convertQuantity(parsedAmount.quantity, parsedAmount.unit, item.unit)!;
    const currentQuantity = Number(item.quantity.toString());
    return {
      id: String(index), ingredientName, recipeAmount, status: suggestedQuantity <= currentQuantity ? 'MATCHED' as const : 'INSUFFICIENT' as const,
      itemId: item.id, itemName: item.name, unit: item.unit, currentQuantity: String(currentQuantity),
      suggestedQuantity: String(suggestedQuantity), remainingQuantity: String(roundQuantity(currentQuantity - suggestedQuantity)),
      expirationDate: item.expirationDate?.toISOString().slice(0, 10) ?? null,
      message: suggestedQuantity <= currentQuantity ? undefined : '냉장고 수량보다 많이 필요합니다. 차감량을 수정해주세요.',
    };
  }
}

function parseRecipeAmount(value: string) {
  const match = value.trim().match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(kg|g|ml|mL|L|l|개|ea|팩|봉|병|캔)/);
  if (!match) return undefined;
  const quantity = match[1].includes('/')
    ? Number(match[1].split('/')[0]) / Number(match[1].split('/')[1])
    : Number(match[1]);
  const unit = UNIT_ALIASES.find(([pattern]) => pattern.test(match[2]))?.[1];
  return quantity > 0 && unit ? { quantity, unit } : undefined;
}

function convertQuantity(quantity: number, from: Unit, to: Unit) {
  if (from === to) return roundQuantity(quantity);
  const mass = { G: 1, KG: 1000 } as const;
  const volume = { ML: 1, L: 1000 } as const;
  if (from in mass && to in mass) return roundQuantity(quantity * mass[from as keyof typeof mass] / mass[to as keyof typeof mass]);
  if (from in volume && to in volume) return roundQuantity(quantity * volume[from as keyof typeof volume] / volume[to as keyof typeof volume]);
  return undefined;
}

function parseConsumption(input: unknown) {
  if (!input || typeof input !== 'object') throw new BadRequestException('차감 정보를 입력해주세요.');
  const value = input as Record<string, unknown>;
  if (typeof value.idempotencyKey !== 'string' || !IDEMPOTENCY_PATTERN.test(value.idempotencyKey)) throw new BadRequestException('유효한 중복 방지 키가 필요합니다.');
  if (typeof value.recipeTitle !== 'string' || !value.recipeTitle.trim() || value.recipeTitle.length > 100) throw new BadRequestException('레시피 이름이 필요합니다.');
  if (!Array.isArray(value.deductions) || value.deductions.length < 1 || value.deductions.length > 50) throw new BadRequestException('차감할 재료를 하나 이상 선택해주세요.');
  const seenItemIds = new Set<string>();
  const deductions = value.deductions.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new BadRequestException('차감 정보가 올바르지 않습니다.');
    const deduction = entry as Record<string, unknown>;
    if (typeof deduction.itemId !== 'string' || !/^[0-9a-f-]{36}$/i.test(deduction.itemId)) throw new BadRequestException('유효한 식재료 ID가 필요합니다.');
    if (seenItemIds.has(deduction.itemId)) throw new BadRequestException('같은 냉장고 재료는 한 번만 변경할 수 있습니다.');
    seenItemIds.add(deduction.itemId);
    if (deduction.remainingQuantity !== undefined || deduction.unit !== undefined) {
      const remainingText = String(deduction.remainingQuantity ?? '').trim();
      if (!QUANTITY_PATTERN.test(remainingText) || Number(remainingText) < 0) throw new BadRequestException('남은 양은 0 이상이고 소수점 셋째 자리까지 입력할 수 있습니다.');
      if (typeof deduction.unit !== 'string' || !UNITS.includes(deduction.unit as Unit)) throw new BadRequestException('지원하는 수량 단위를 선택해주세요.');
      return { mode: 'SET_REMAINING' as const, itemId: deduction.itemId, remainingQuantity: Number(remainingText), unit: deduction.unit as Unit };
    }
    const quantityText = String(deduction.quantity ?? '').trim();
    if (!QUANTITY_PATTERN.test(quantityText) || Number(quantityText) <= 0) throw new BadRequestException('차감량은 0보다 크고 소수점 셋째 자리까지 입력할 수 있습니다.');
    return { mode: 'DEDUCT' as const, itemId: deduction.itemId, quantity: Number(quantityText) };
  });
  return { idempotencyKey: value.idempotencyKey, recipeTitle: value.recipeTitle.trim(), deductions };
}

function normalizeName(value: string) { return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR'); }
function roundQuantity(value: number) { return Math.round(value * 1000) / 1000; }
function isUniqueConstraintError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
