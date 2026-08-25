import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecipeComment, RecipeCommentPage } from './recipe-comment';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class RecipeCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, loginId: string, recipePostId: string, rawCursor?: string, rawLimit?: string): Promise<RecipeCommentPage> {
    this.validateId(recipePostId, '레시피');
    await this.ensurePostExists(recipePostId);
    const cursor = rawCursor?.trim();
    if (cursor) this.validateId(cursor, '댓글 커서');
    const limit = this.parseLimit(rawLimit);
    const records = await this.prisma.client.recipeComment.findMany({
      where: { recipePostId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { author: { select: { id: true, nickname: true } } },
    });
    const hasNext = records.length > limit;
    const page = hasNext ? records.slice(0, limit) : records;
    return {
      items: page.map((record) => this.map(record, userId, isAdminLoginId(loginId))),
      nextCursor: hasNext ? page[page.length - 1].id : null,
    };
  }

  async create(userId: string, recipePostId: string, input: unknown) {
    this.validateId(recipePostId, '레시피');
    await this.ensurePostExists(recipePostId);
    const content = this.parseContent(input);
    const record = await this.prisma.client.recipeComment.create({
      data: { authorId: userId, recipePostId, content },
      include: { author: { select: { id: true, nickname: true } } },
    });
    return this.map(record, userId);
  }

  async update(userId: string, commentId: string, input: unknown) {
    this.validateId(commentId, '댓글');
    const content = this.parseContent(input);
    const current = await this.prisma.client.recipeComment.findUnique({ where: { id: commentId } });
    if (!current) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (current.authorId !== userId) throw new ForbiddenException('내 댓글만 수정할 수 있습니다.');
    const record = await this.prisma.client.recipeComment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: { id: true, nickname: true } } },
    });
    return this.map(record, userId);
  }

  async remove(userId: string, loginId: string, commentId: string) {
    this.validateId(commentId, '댓글');
    const current = await this.prisma.client.recipeComment.findUnique({ where: { id: commentId } });
    if (!current) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (current.authorId !== userId && !isAdminLoginId(loginId)) {
      throw new ForbiddenException('본인 또는 관리자만 댓글을 삭제할 수 있습니다.');
    }
    await this.prisma.client.recipeComment.delete({ where: { id: commentId } });
  }

  private async ensurePostExists(recipePostId: string) {
    const post = await this.prisma.client.recipePost.findUnique({ where: { id: recipePostId }, select: { id: true } });
    if (!post) throw new NotFoundException('레시피를 찾을 수 없습니다.');
  }

  private parseContent(input: unknown) {
    if (!input || typeof input !== 'object' || !('content' in input) || typeof input.content !== 'string') {
      throw new BadRequestException('댓글 내용을 입력해주세요.');
    }
    const content = input.content.trim();
    if (!content || content.length > 500) throw new BadRequestException('댓글은 1~500자로 입력해주세요.');
    return content;
  }

  private parseLimit(rawLimit?: string) {
    if (rawLimit === undefined) return DEFAULT_LIMIT;
    if (!/^\d+$/.test(rawLimit)) throw new BadRequestException('댓글 조회 개수는 숫자여야 합니다.');
    const limit = Number(rawLimit);
    if (limit < 1 || limit > MAX_LIMIT) throw new BadRequestException(`댓글은 한 번에 1~${MAX_LIMIT}개까지 조회할 수 있습니다.`);
    return limit;
  }

  private validateId(id: string, label: string) {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException(`유효한 ${label} ID가 필요합니다.`);
  }

  private map(record: { id: string; recipePostId: string; content: string; createdAt: Date; updatedAt: Date; author: { id: string; nickname: string } }, userId: string, isAdmin = false): RecipeComment {
    const isOwn = record.author.id === userId;
    return {
      id: record.id,
      recipePostId: record.recipePostId,
      author: record.author,
      content: record.content,
      isOwn,
      canDelete: isOwn || isAdmin,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

function isAdminLoginId(loginId: string) {
  const normalizedLoginId = loginId.trim().toLocaleLowerCase('en-US');
  return (process.env.ADMIN_LOGIN_IDS ?? '')
    .split(',')
    .map((value) => value.trim().toLocaleLowerCase('en-US'))
    .filter(Boolean)
    .includes(normalizedLoginId);
}
