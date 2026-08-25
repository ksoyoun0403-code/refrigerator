import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ingredientNames,
  recipeFingerprint,
  validateSavedRecipeInput,
} from '../saved-recipes/saved-recipes.service';
import { RecipePost, RecipePostListItem } from './recipe-post';

type RecipePostRecord = {
  id: string;
  title: string;
  summary: string;
  ingredientNames: string[];
  recipe: unknown;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; nickname: string } | null;
  _count: { bookmarks: number; comments: number };
  bookmarks?: { userId: string }[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RecipePostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, rawQuery?: string, rawSort?: string): Promise<RecipePostListItem[]> {
    const query = normalizeSearchQuery(rawQuery);
    const sort = normalizeFeedSort(rawSort);
    const matchingIds = query
      ? await this.findMatchingPostIds(query)
      : undefined;
    const records = await this.prisma.client.recipePost.findMany({
      where: matchingIds ? { id: { in: matchingIds } } : undefined,
      orderBy: sort === 'latest'
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : [
            { bookmarks: { _count: 'desc' } },
            { comments: { _count: 'desc' } },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
      take: 50,
      include: recipePostIncludeForUser(userId),
    });
    return records.map((record) => mapRecipePostListItem(record, userId));
  }

  private async findMatchingPostIds(query: string) {
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string }>>`
      SELECT post.id
      FROM recipe_posts AS post
      WHERE strpos(lower(post.title), lower(${query})) > 0
         OR EXISTS (
           SELECT 1
           FROM unnest(post."ingredientNames") AS ingredient(name)
           WHERE strpos(lower(ingredient.name), lower(${query})) > 0
         )
    `;
    return rows.map(({ id }) => id);
  }

  async findOne(userId: string, id: string): Promise<RecipePost> {
    validateRecipePostId(id);
    const record = await this.prisma.client.recipePost.findUnique({
      where: { id },
      include: recipePostIncludeForUser(userId),
    });
    if (!record) throw new NotFoundException('레시피를 찾을 수 없습니다.');
    return mapRecipePost(record, isBookmarkedBy(record, userId), userId);
  }

  async findMine(userId: string, rawQuery?: string): Promise<RecipePostListItem[]> {
    const matchingIds = await this.matchingIdsForQuery(rawQuery);
    const records = await this.prisma.client.recipePost.findMany({
      where: { authorId: userId, ...(matchingIds ? { id: { in: matchingIds } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: recipePostIncludeForUser(userId),
    });
    return records.map((record) => mapRecipePostListItem(record, userId));
  }

  async findBookmarked(userId: string, rawQuery?: string): Promise<RecipePostListItem[]> {
    const matchingIds = await this.matchingIdsForQuery(rawQuery);
    const records = await this.prisma.client.recipePost.findMany({
      where: {
        bookmarks: { some: { userId } },
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: recipePostIncludeForUser(userId),
    });
    return records.map((record) => mapRecipePostListItem(record, userId));
  }

  private async matchingIdsForQuery(rawQuery?: string) {
    const query = normalizeSearchQuery(rawQuery);
    return query ? this.findMatchingPostIds(query) : undefined;
  }

  async create(authorId: string, input: unknown): Promise<RecipePost> {
    const recipe = validateSavedRecipeInput(input);
    const fingerprint = recipeFingerprint(recipe);
    const existing = await this.findByAuthorAndFingerprint(authorId, fingerprint);
    if (existing) return mapRecipePost(existing, false, authorId);

    try {
      const created = await this.prisma.client.recipePost.create({
        data: {
          authorId,
          fingerprint,
          title: recipe.title,
          summary: recipe.summary,
          ingredientNames: ingredientNames(recipe),
          recipe: JSON.parse(JSON.stringify(recipe)),
        },
        include: recipePostInclude,
      });
      return mapRecipePost(created, false, authorId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrentlyCreated = await this.findByAuthorAndFingerprint(
          authorId,
          fingerprint,
        );
        if (concurrentlyCreated) return mapRecipePost(concurrentlyCreated, false, authorId);
      }
      throw error;
    }
  }

  async bookmark(userId: string, recipePostId: string): Promise<RecipePost> {
    validateRecipePostId(recipePostId);
    const post = await this.prisma.client.recipePost.findUnique({
      where: { id: recipePostId },
      select: { id: true, authorId: true },
    });
    if (!post) throw new NotFoundException('레시피를 찾을 수 없습니다.');
    if (post.authorId === userId) {
      throw new ConflictException('내 레시피는 북마크할 수 없습니다.');
    }

    try {
      await this.prisma.client.recipeBookmark.create({
        data: { userId, recipePostId },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const updated = await this.findById(recipePostId);
    if (!updated) throw new NotFoundException('레시피를 찾을 수 없습니다.');
    return mapRecipePost(updated, true, userId);
  }

  async removeBookmark(userId: string, recipePostId: string) {
    validateRecipePostId(recipePostId);
    const post = await this.prisma.client.recipePost.findUnique({
      where: { id: recipePostId },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('레시피를 찾을 수 없습니다.');

    await this.prisma.client.recipeBookmark.deleteMany({
      where: { userId, recipePostId },
    });
  }

  async remove(userId: string, recipePostId: string) {
    validateRecipePostId(recipePostId);
    const post = await this.prisma.client.recipePost.findUnique({
      where: { id: recipePostId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('레시피를 찾을 수 없습니다.');
    if (post.authorId !== userId) {
      throw new ForbiddenException('내 레시피만 삭제할 수 있습니다.');
    }
    await this.prisma.client.recipePost.delete({ where: { id: recipePostId } });
  }

  private findByAuthorAndFingerprint(authorId: string, fingerprint: string) {
    return this.prisma.client.recipePost.findUnique({
      where: { authorId_fingerprint: { authorId, fingerprint } },
      include: recipePostInclude,
    });
  }

  private findById(id: string) {
    return this.prisma.client.recipePost.findUnique({
      where: { id },
      include: recipePostInclude,
    });
  }
}

const recipePostInclude = {
  author: { select: { id: true, nickname: true } },
  _count: { select: { bookmarks: true, comments: true } },
} as const;

function recipePostIncludeForUser(userId: string) {
  return {
    ...recipePostInclude,
    bookmarks: { where: { userId }, select: { userId: true } },
  } as const;
}

function mapRecipePost(
  record: RecipePostRecord,
  isBookmarked: boolean,
  currentUserId: string,
): RecipePost {
  return {
    id: record.id,
    author: record.author ?? { id: null, nickname: '익명' },
    title: record.title,
    summary: record.summary,
    ingredientNames: record.ingredientNames,
    recipe: record.recipe as RecipePost['recipe'],
    bookmarkCount: record._count.bookmarks,
    commentCount: record._count.comments,
    isBookmarked,
    isOwn: record.author?.id === currentUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapRecipePostListItem(
  record: RecipePostRecord,
  currentUserId: string,
): RecipePostListItem {
  const { recipe: _recipe, summary: _summary, ...item } = mapRecipePost(
    record,
    isBookmarkedBy(record, currentUserId),
    currentUserId,
  );
  return item;
}

function isBookmarkedBy(record: RecipePostRecord, userId: string) {
  return Boolean(record.bookmarks?.some((bookmark) => bookmark.userId === userId));
}

function normalizeSearchQuery(rawQuery?: string) {
  if (rawQuery === undefined) return undefined;
  if (typeof rawQuery !== 'string') {
    throw new BadRequestException('검색어는 문자열이어야 합니다.');
  }
  const query = rawQuery.trim();
  if (query.length > 100) {
    throw new BadRequestException('검색어는 100자 이하여야 합니다.');
  }
  return query || undefined;
}

function normalizeFeedSort(rawSort?: string): 'popular' | 'latest' {
  if (rawSort === undefined || rawSort === '' || rawSort === 'popular') return 'popular';
  if (rawSort === 'latest') return 'latest';
  throw new BadRequestException('정렬 기준은 popular 또는 latest여야 합니다.');
}

function validateRecipePostId(id: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new BadRequestException('유효한 레시피 ID가 필요합니다.');
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
