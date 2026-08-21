import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateExpirationItem,
  EXPIRATION_ITEM_UNITS,
  ExpirationItem,
  ExpirationItemUnit,
  UpdateExpirationItem,
} from './expiration-item';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUANTITY_PATTERN = /^\d{1,6}(?:\.\d{1,3})?$/;
const USE_SOON_DAYS = 3;

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toDatabaseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = toDatabaseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function shouldUseSoon(expirationDate: string | null) {
  return Boolean(
    expirationDate && expirationDate <= addDays(todayInSeoul(), USE_SOON_DAYS),
  );
}

function mapItem(item: {
  id: string;
  scanId: string;
  name: string;
  quantity: { toString(): string };
  unit: string;
  purchasedAt: Date;
  expirationDate: Date | null;
  source: string;
  section: string;
  sortOrder: number;
  createdAt: Date;
}): ExpirationItem {
  return {
    id: item.id,
    scanId: item.scanId,
    name: item.name,
    quantity: item.quantity.toString(),
    unit: item.unit as ExpirationItemUnit,
    purchasedAt: dateOnly(item.purchasedAt),
    expirationDate: item.expirationDate ? dateOnly(item.expirationDate) : null,
    source: item.source === 'MANUAL' ? 'manual' : 'image',
    section: item.section as ExpirationItem['section'],
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
  };
}

@Injectable()
export class ExpirationItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    await this.promoteUseSoonItems();

    const [useSoonItems, defaultItems] = await Promise.all([
      this.prisma.client.expirationItem.findMany({
        where: { section: 'USE_SOON' },
        orderBy: [
          { expirationDate: { sort: 'asc', nulls: 'last' } },
          { purchasedAt: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.client.expirationItem.findMany({
        where: { section: 'DEFAULT' },
        orderBy: [
          { expirationDate: { sort: 'asc', nulls: 'last' } },
          { purchasedAt: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);
    return [...useSoonItems, ...defaultItems].map(mapItem);
  }

  async create(input: CreateExpirationItem) {
    const normalized = this.validate(input);

    try {
      if (!normalized.scanId) {
        const item = await this.prisma.client.$transaction(
          async (transaction) => {
            const section = shouldUseSoon(normalized.expirationDate)
              ? 'USE_SOON'
              : 'DEFAULT';
            const lastPosition = await transaction.expirationItem.aggregate({
              where: { section },
              _max: { sortOrder: true },
            });
            const scan = await transaction.expirationScan.create({
              data: { status: 'CONFIRMED' },
              select: { id: true },
            });

            return transaction.expirationItem.create({
              data: {
                scanId: scan.id,
                name: normalized.name,
                quantity: normalized.quantity,
                unit: normalized.unit,
                purchasedAt: toDatabaseDate(normalized.purchasedAt),
                expirationDate: normalized.expirationDate
                  ? toDatabaseDate(normalized.expirationDate)
                  : null,
                source: 'MANUAL',
                section,
                sortOrder: (lastPosition._max.sortOrder ?? -1) + 1,
              },
            });
          },
        );

        return mapItem(item);
      }

      const item = await this.prisma.client.$transaction(async (transaction) => {
        const scan = await transaction.expirationScan.findUnique({
          where: { id: normalized.scanId },
        });
        if (!scan) {
          throw new NotFoundException('스캔 결과를 찾을 수 없습니다.');
        }
        if (scan.status !== 'NEEDS_REVIEW') {
          throw new ConflictException('이미 등록했거나 등록할 수 없는 스캔입니다.');
        }

        const lastPosition = await transaction.expirationItem.aggregate({
          where: {
            section: shouldUseSoon(normalized.expirationDate)
              ? 'USE_SOON'
              : 'DEFAULT',
          },
          _max: { sortOrder: true },
        });
        const section = shouldUseSoon(normalized.expirationDate)
          ? 'USE_SOON'
          : 'DEFAULT';
        const claimed = await transaction.expirationScan.updateMany({
          where: { id: scan.id, status: 'NEEDS_REVIEW' },
          data: { status: 'CONFIRMED' },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('이미 등록된 스캔입니다.');
        }

        return transaction.expirationItem.create({
          data: {
            scanId: scan.id,
            name: normalized.name,
            quantity: normalized.quantity,
            unit: normalized.unit,
            purchasedAt: toDatabaseDate(normalized.purchasedAt),
            expirationDate: normalized.expirationDate
              ? toDatabaseDate(normalized.expirationDate)
              : null,
            source: 'IMAGE',
            section,
            sortOrder: (lastPosition._max.sortOrder ?? -1) + 1,
          },
        });
      });

      return mapItem(item);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('이미 등록된 스캔입니다.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('유효한 식재료 ID가 필요합니다.');
    }

    await this.prisma.client.$transaction(async (transaction) => {
      const item = await transaction.expirationItem.findUnique({
        where: { id },
        select: { id: true, scanId: true },
      });
      if (!item) {
        throw new NotFoundException('삭제할 식재료를 찾을 수 없습니다.');
      }

      await transaction.expirationItem.delete({ where: { id: item.id } });
      await transaction.expirationScan.delete({
        where: { id: item.scanId },
      });
    });
  }

  async update(id: string, input: UpdateExpirationItem) {
    this.validateId(id);
    const normalized = this.validateUpdate(input);

    const item = await this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.expirationItem.findUnique({
        where: { id },
      });
      if (!current) {
        throw new NotFoundException('수정할 식재료를 찾을 수 없습니다.');
      }

      let sortOrder = current.sortOrder;
      const section =
        normalized.expirationDate !== undefined &&
        shouldUseSoon(normalized.expirationDate)
          ? 'USE_SOON'
          : normalized.section;
      if (section === 'USE_SOON' && current.section !== 'USE_SOON') {
        const lastPosition = await transaction.expirationItem.aggregate({
          where: { section: 'USE_SOON' },
          _max: { sortOrder: true },
        });
        sortOrder = (lastPosition._max.sortOrder ?? -1) + 1;
      }

      return transaction.expirationItem.update({
        where: { id },
        data: {
          ...normalized,
          purchasedAt: normalized.purchasedAt
            ? toDatabaseDate(normalized.purchasedAt)
            : undefined,
          expirationDate:
            normalized.expirationDate === undefined
              ? undefined
              : normalized.expirationDate
                ? toDatabaseDate(normalized.expirationDate)
                : null,
          section,
          sortOrder,
        },
      });
    });

    return mapItem(item);
  }

  private validate(input: CreateExpirationItem) {
    const scanId = input.scanId?.trim();
    const name = input.name?.trim();
    const quantity = input.quantity?.trim();
    const unit = input.unit;
    const purchasedAt = input.purchasedAt?.trim() || todayInSeoul();
    const expirationDate = input.expirationDate?.trim() || null;

    if (scanId && !UUID_PATTERN.test(scanId)) {
      throw new BadRequestException('유효한 scanId가 필요합니다.');
    }
    if (!name || name.length > 100) {
      throw new BadRequestException('식재료 이름은 1~100자로 입력해주세요.');
    }
    if (
      !quantity ||
      !QUANTITY_PATTERN.test(quantity) ||
      Number(quantity) <= 0 ||
      Number(quantity) > 999999
    ) {
      throw new BadRequestException(
        '수량은 0보다 크고 소수점 셋째 자리까지 입력할 수 있습니다.',
      );
    }
    if (!EXPIRATION_ITEM_UNITS.includes(unit)) {
      throw new BadRequestException('지원하는 수량 단위를 선택해주세요.');
    }
    if (!isCalendarDate(purchasedAt)) {
      throw new BadRequestException('구매일은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (expirationDate && !isCalendarDate(expirationDate)) {
      throw new BadRequestException('유통기한은 YYYY-MM-DD 형식이어야 합니다.');
    }

    return { scanId, name, quantity, unit, purchasedAt, expirationDate };
  }

  private validateUpdate(input: UpdateExpirationItem) {
    const hasField =
      input.name !== undefined ||
      input.quantity !== undefined ||
      input.unit !== undefined ||
      input.purchasedAt !== undefined ||
      input.expirationDate !== undefined ||
      input.section !== undefined;
    if (!hasField) {
      throw new BadRequestException('수정할 정보를 하나 이상 입력해주세요.');
    }

    const name = input.name?.trim();
    const quantity = input.quantity?.trim();
    const purchasedAt = input.purchasedAt?.trim();
    const expirationDate = input.expirationDate?.trim() || null;

    if (input.name !== undefined && (!name || name.length > 100)) {
      throw new BadRequestException('식재료 이름은 1~100자로 입력해주세요.');
    }
    if (
      input.quantity !== undefined &&
      (!quantity ||
        !QUANTITY_PATTERN.test(quantity) ||
        Number(quantity) <= 0 ||
        Number(quantity) > 999999)
    ) {
      throw new BadRequestException(
        '수량은 0보다 크고 소수점 셋째 자리까지 입력할 수 있습니다.',
      );
    }
    if (
      input.unit !== undefined &&
      !EXPIRATION_ITEM_UNITS.includes(input.unit)
    ) {
      throw new BadRequestException('지원하는 수량 단위를 선택해주세요.');
    }
    if (input.purchasedAt !== undefined && (!purchasedAt || !isCalendarDate(purchasedAt))) {
      throw new BadRequestException('구매일은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (expirationDate && !isCalendarDate(expirationDate)) {
      throw new BadRequestException('유통기한은 YYYY-MM-DD 형식이어야 합니다.');
    }
    if (
      input.section !== undefined &&
      input.section !== 'DEFAULT' &&
      input.section !== 'USE_SOON'
    ) {
      throw new BadRequestException('지원하는 냉장고 구역을 선택해주세요.');
    }

    return {
      name: input.name === undefined ? undefined : name,
      quantity: input.quantity === undefined ? undefined : quantity,
      unit: input.unit,
      purchasedAt: input.purchasedAt === undefined ? undefined : purchasedAt,
      expirationDate:
        input.expirationDate === undefined ? undefined : expirationDate,
      section: input.section,
    };
  }

  private validateId(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('유효한 식재료 ID가 필요합니다.');
    }
  }

  private async promoteUseSoonItems() {
    await this.prisma.client.expirationItem.updateMany({
      where: {
        section: 'DEFAULT',
        expirationDate: {
          lte: toDatabaseDate(addDays(todayInSeoul(), USE_SOON_DAYS)),
        },
      },
      data: { section: 'USE_SOON' },
    });
  }
}
