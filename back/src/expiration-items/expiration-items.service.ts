import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateExpirationItem, ExpirationItem } from './expiration-item';

@Injectable()
export class ExpirationItemsService {
  // Persistence is intentionally behind this service so a DB repository can replace it.
  private readonly items: ExpirationItem[] = [];

  findAll() {
    return [...this.items].sort((a, b) =>
      a.expirationDate.localeCompare(b.expirationDate),
    );
  }

  create(input: CreateExpirationItem) {
    if (!input.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.expirationDate)) {
      throw new BadRequestException('이름과 YYYY-MM-DD 형식의 유통기한이 필요합니다.');
    }

    const item: ExpirationItem = {
      id: randomUUID(),
      name: input.name.trim(),
      expirationDate: input.expirationDate,
      source: input.source ?? 'image',
      createdAt: new Date().toISOString(),
    };
    this.items.push(item);
    return item;
  }
}
