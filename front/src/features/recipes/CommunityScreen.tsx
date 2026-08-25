import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import { RecipeCard } from './RecipeCard';
import { RecipeComments } from './RecipeComments';
import { bookmarkRecipePost, deleteRecipePost, getBookmarkedRecipePosts, getMyRecipePosts, getRecipePost, getRecipePosts, removeRecipePostBookmark } from './communityApi';
import { RecipePost, RecipePostListItem } from './types';
import { getExpirationItems } from '../expiration/expirationApi';

const bookmarkIcon = require('../../../assets/icons/bookmark.png');
const backIcon = require('../../../assets/icons/back.png');
const cookbookIcon = require('../../../assets/icons/cookbook.png');

export function CommunityScreen({ backSignal, isActive, onCloseCookbook, onDetailStateChange, onOpenCookbook, view }: {
  backSignal: number;
  isActive: boolean;
  onCloseCookbook(): void;
  onDetailStateChange(isOpen: boolean): void;
  onOpenCookbook(): void;
  view: 'feed' | 'cookbook';
}) {
  const requestId = useRef(0);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'latest'>('popular');
  const [posts, setPosts] = useState<RecipePostListItem[]>([]);
  const [selectedPost, setSelectedPost] = useState<RecipePost>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [inventoryNames, setInventoryNames] = useState<Set<string>>();

  const loadInventoryNames = useCallback(async () => {
    try {
      const items = await getExpirationItems();
      setInventoryNames(new Set(items.map((item) => normalizeIngredientName(item.name))));
    } catch {
      setInventoryNames(undefined);
    }
  }, []);

  const loadPosts = useCallback(async (search = appliedQuery) => {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const loaded = await getRecipePosts(search, sort);
      if (currentRequest === requestId.current) setPosts(loaded);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setPosts([]);
      setErrorMessage(error instanceof Error ? error.message : '목록을 불러오지 못했습니다.');
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [appliedQuery, sort]);

  useEffect(() => {
    if (isActive) void loadPosts();
    else requestId.current += 1;
  }, [isActive, loadPosts]);

  useEffect(() => {
    if (!isActive) return;
    void loadInventoryNames();
  }, [isActive, loadInventoryNames]);

  useEffect(() => {
    setSelectedPost(undefined);
  }, [view]);

  useEffect(() => {
    onDetailStateChange(Boolean(selectedPost));
  }, [onDetailStateChange, selectedPost]);

  useEffect(() => {
    if (backSignal > 0) setSelectedPost(undefined);
  }, [backSignal]);

  const search = () => {
    const nextQuery = query.trim();
    setAppliedQuery(nextQuery);
    void loadPosts(nextQuery);
  };

  const clearSearch = () => {
    setQuery('');
    setAppliedQuery('');
    void loadPosts('');
  };

  const openPost = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      setSelectedPost(await getRecipePost(id));
    } catch (error) {
      Alert.alert('레시피를 열지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const toggleBookmark = async () => {
    if (!selectedPost || selectedPost.isOwn || isBookmarking) return;
    setIsBookmarking(true);
    try {
      if (selectedPost.isBookmarked) {
        await removeRecipePostBookmark(selectedPost.id);
        setSelectedPost({ ...selectedPost, isBookmarked: false, bookmarkCount: Math.max(0, selectedPost.bookmarkCount - 1) });
      } else {
        setSelectedPost(await bookmarkRecipePost(selectedPost.id));
      }
      await loadPosts();
    } catch (error) {
      Alert.alert('북마크를 변경하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsBookmarking(false);
    }
  };

  if (selectedPost) {
    return (
      <ScrollView contentContainerStyle={styles.detailContainer}>
        <Button
          iconSource={backIcon}
          iconStyle={styles.detailBackIcon}
          iconTintColor={colors.brand.action}
          label="목록으로 돌아가기"
          onPress={() => setSelectedPost(undefined)}
          style={styles.detailBackButton}
          variant="ghost"
        />
        <Text style={styles.author}>@{selectedPost.author.nickname}</Text>
        <RecipeCard
          bookmarkState={isBookmarking ? 'loading' : selectedPost.isBookmarked ? 'saved' : 'idle'}
          onBookmarkPress={selectedPost.isOwn ? undefined : () => void toggleBookmark()}
          onIngredientsConsumed={() => void loadInventoryNames()}
          recipe={selectedPost.recipe}
        />
        <Text style={styles.bookmarkCount}>북마크 {selectedPost.bookmarkCount}회</Text>
        <RecipeComments
          initialCount={selectedPost.commentCount}
          onCountChange={(commentCount) => {
            setSelectedPost((current) => current ? { ...current, commentCount } : current);
            setPosts((current) => current.map((post) => post.id === selectedPost.id ? { ...post, commentCount } : post));
          }}
          recipePostId={selectedPost.id}
        />
      </ScrollView>
    );
  }

  if (view === 'cookbook') {
    return <CookbookScreen inventoryNames={inventoryNames} isActive={isActive} onClose={onCloseCookbook} onOpenPost={(id) => void openPost(id)} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>공유 레시피</Text>
        </View>
        <Button
          iconSource={cookbookIcon}
          iconTintColor={colors.brand.action}
          label="나의 요리책"
          onPress={onOpenCookbook}
          style={styles.cookbookButton}
          variant="ghost"
        />
      </View>
      <View style={styles.searchRow}>
        <TextInput accessibilityLabel="레시피 검색" maxLength={100} onChangeText={setQuery} onSubmitEditing={search} placeholder="레시피 이름이나 재료를 검색해보세요" placeholderTextColor={colors.text.muted} returnKeyType="search" style={styles.searchInput} value={query} />
        <Button label="검색" onPress={search} style={styles.searchButton} />
      </View>
      <View style={styles.feedSortRow}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSort('popular')}>
          <Text style={[styles.feedSortText, sort === 'popular' && styles.feedSortTextSelected]}>인기순</Text>
        </Pressable>
        <Text style={styles.feedSortDivider}>|</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSort('latest')}>
          <Text style={[styles.feedSortText, sort === 'latest' && styles.feedSortTextSelected]}>최신순</Text>
        </Pressable>
      </View>
      {appliedQuery && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultText}>‘{appliedQuery}’ 검색 결과 {posts.length}개</Text>
          <Button label="검색 해제" onPress={clearSearch} variant="ghost" />
        </View>
      )}
      {isLoading || isLoadingDetail ? (
        <View style={styles.stateBox}><ActivityIndicator color={colors.brand.action} /></View>
      ) : errorMessage ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>목록을 불러오지 못했어요</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="다시 불러오기" onPress={() => void loadPosts()} variant="secondary" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>{appliedQuery ? '검색 결과가 없어요' : '아직 공유된 레시피가 없어요'}</Text>
          <Text style={styles.stateBody}>{appliedQuery ? '다른 레시피 이름이나 재료로 검색해보세요.' : 'AI 레시피를 생성하고 공유 레시피에 등록해보세요.'}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {posts.map((post) => (
            <Pressable accessibilityRole="button" key={post.id} onPress={() => void openPost(post.id)} style={({ pressed }) => [styles.postCard, pressed && styles.pressed]}>
              <View style={styles.postHeader}>
                <Text style={styles.postAuthor}>@{post.author.nickname}</Text>
                <View style={styles.postMetrics}>
                  <Text style={styles.postComment}>댓글 {post.commentCount}</Text>
                  <View style={styles.postBookmarkMetric}>
                    <Image resizeMode="contain" source={bookmarkIcon} style={styles.postBookmarkIcon} />
                    <Text style={styles.postBookmark}>{post.bookmarkCount}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text numberOfLines={2} style={styles.ingredients}>{post.ingredientNames.join(' · ')}</Text>
              {inventoryNames && <IngredientAvailabilityBadge ingredientNames={post.ingredientNames} inventoryNames={inventoryNames} />}
              <Text style={styles.openLabel}>전체 레시피 보기 →</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function CookbookScreen({ inventoryNames, isActive, onClose, onOpenPost }: { inventoryNames?: Set<string>; isActive: boolean; onClose(): void; onOpenPost(id: string): void }) {
  const [section, setSection] = useState<'mine' | 'bookmarked'>('mine');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [mine, setMine] = useState<RecipePostListItem[]>([]);
  const [bookmarked, setBookmarked] = useState<RecipePostListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async (search = appliedQuery) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const [myPosts, bookmarkedPosts] = await Promise.all([
        getMyRecipePosts(search),
        getBookmarkedRecipePosts(search),
      ]);
      setMine(myPosts);
      setBookmarked(bookmarkedPosts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '나의 요리책을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [appliedQuery]);

  useEffect(() => {
    if (isActive) void load();
  }, [isActive, load]);

  const confirmDelete = (post: RecipePostListItem) => {
    Alert.alert(
      '내 레시피를 삭제할까요?',
      '공유 레시피 목록과 다른 사용자의 북마크에서도 함께 사라집니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setWorkingId(post.id);
            try {
              await deleteRecipePost(post.id);
              setMine((current) => current.filter(({ id }) => id !== post.id));
            } catch (error) {
              Alert.alert('삭제하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
            } finally {
              setWorkingId(undefined);
            }
          },
        },
      ],
    );
  };

  const removeBookmark = async (post: RecipePostListItem) => {
    setWorkingId(post.id);
    try {
      await removeRecipePostBookmark(post.id);
      setBookmarked((current) => current.filter(({ id }) => id !== post.id));
    } catch (error) {
      Alert.alert('북마크를 해제하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setWorkingId(undefined);
    }
  };

  const items = section === 'mine' ? mine : bookmarked;
  const search = () => {
    const nextQuery = query.trim();
    setAppliedQuery(nextQuery);
    void load(nextQuery);
  };
  const clearSearch = () => {
    setQuery('');
    setAppliedQuery('');
    void load('');
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>나의 요리책</Text>
        <Pressable accessibilityLabel="나의 요리책 닫기" accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <Text style={styles.closeButtonText}>닫기</Text>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="나의 요리책 검색"
          maxLength={100}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="내 레시피 이름이나 재료 검색"
          placeholderTextColor={colors.text.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Button label="검색" onPress={search} style={styles.searchButton} />
      </View>
      {appliedQuery && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultText}>‘{appliedQuery}’ 검색 중</Text>
          <Button label="검색 해제" onPress={clearSearch} variant="ghost" />
        </View>
      )}
      <View style={styles.segmentRow}>
        <Button label={`내 레시피 ${mine.length}`} onPress={() => setSection('mine')} variant={section === 'mine' ? 'primary' : 'secondary'} style={styles.segmentButton} />
        <Button label={`북마크한 레시피 ${bookmarked.length}`} onPress={() => setSection('bookmarked')} variant={section === 'bookmarked' ? 'primary' : 'secondary'} style={styles.segmentButton} />
      </View>
      {isLoading ? (
        <View style={styles.stateBox}><ActivityIndicator color={colors.brand.action} /></View>
      ) : errorMessage ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>나의 요리책을 불러오지 못했어요</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
          <Button label="다시 불러오기" onPress={() => void load()} variant="secondary" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>{appliedQuery ? '검색 결과가 없어요' : section === 'mine' ? '공유한 내 레시피가 없어요' : '북마크한 레시피가 없어요'}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Pressable accessibilityRole="button" onPress={() => onOpenPost(post.id)} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.postAuthor}>@{post.author.nickname}</Text>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text numberOfLines={2} style={styles.ingredients}>{post.ingredientNames.join(' · ')}</Text>
                {inventoryNames && <IngredientAvailabilityBadge ingredientNames={post.ingredientNames} inventoryNames={inventoryNames} />}
                <View style={[styles.postMetrics, styles.cookbookMetrics]}>
                  <Text style={styles.postComment}>댓글 {post.commentCount}</Text>
                  <View style={styles.postBookmarkMetric}>
                    <Image resizeMode="contain" source={bookmarkIcon} style={styles.postBookmarkIcon} />
                    <Text style={styles.postBookmark}>{post.bookmarkCount}</Text>
                  </View>
                </View>
              </Pressable>
              <Button
                label={section === 'mine' ? '삭제' : '북마크 해제'}
                loading={workingId === post.id}
                onPress={() => section === 'mine' ? confirmDelete(post) : void removeBookmark(post)}
                style={styles.manageButton}
                variant={section === 'mine' ? 'danger' : 'secondary'}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function IngredientAvailabilityBadge({ ingredientNames, inventoryNames }: { ingredientNames: string[]; inventoryNames: Set<string> }) {
  const uniqueIngredients = [...new Set(ingredientNames.map(normalizeIngredientName).filter(Boolean))];
  const owned = uniqueIngredients.filter((name) => inventoryNames.has(name)).length;
  const total = uniqueIngredients.length;
  const complete = total > 0 && owned === total;
  const none = owned === 0;
  return (
    <View style={[styles.availabilityBadge, complete ? styles.availabilityComplete : none ? styles.availabilityNone : styles.availabilityPartial]}>
      <Text style={[styles.availabilityText, complete ? styles.availabilityCompleteText : none ? styles.availabilityNoneText : styles.availabilityPartialText]}>
        {complete ? '모든 재료 보유' : `보유 재료 ${owned}/${total}`}
      </Text>
    </View>
  );
}

function normalizeIngredientName(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.giant },
  detailContainer: { padding: spacing.xl, paddingBottom: spacing.giant },
  detailBackButton: { alignSelf: 'flex-start', marginBottom: spacing.md, minWidth: 0, paddingHorizontal: 0 },
  detailBackIcon: { height: 19, width: 19 },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  titleCopy: { flex: 1 },
  title: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xs },
  cookbookButton: { minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  closeButton: { alignItems: 'center', justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  closeButtonText: { color: colors.brand.action, ...typography.label, fontWeight: '800' },
  segmentRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  segmentButton: { flex: 1, paddingHorizontal: spacing.sm },
  manageButton: { marginTop: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  searchInput: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.full, borderWidth: 1, color: colors.text.primary, flex: 1, minHeight: 48, paddingHorizontal: spacing.lg, ...typography.body },
  searchButton: { minWidth: 72, paddingHorizontal: spacing.md },
  feedSortRow: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.xs },
  feedSortText: { color: colors.text.muted, ...typography.caption },
  feedSortTextSelected: { color: colors.brand.action, fontWeight: '800' },
  feedSortDivider: { color: colors.borderStrong, ...typography.caption },
  resultHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  resultText: { color: colors.text.secondary, ...typography.caption, flex: 1 },
  list: { gap: spacing.md, marginTop: spacing.xl },
  postCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, padding: spacing.xl },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  postMetrics: { flexDirection: 'row', gap: spacing.md },
  cookbookMetrics: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  postComment: { color: colors.text.muted, ...typography.label },
  postBookmarkMetric: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  postBookmarkIcon: { height: 16, tintColor: colors.text.secondary, width: 13 },
  postAuthor: { color: colors.brand.action, ...typography.label },
  postBookmark: { color: colors.text.secondary, ...typography.label },
  postTitle: { color: colors.text.primary, ...typography.title, marginTop: spacing.md },
  ingredients: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  availabilityBadge: { alignSelf: 'flex-start', borderRadius: radii.full, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  availabilityComplete: { backgroundColor: colors.successSoft },
  availabilityPartial: { backgroundColor: colors.brand.soft },
  availabilityNone: { backgroundColor: colors.surfaceMuted },
  availabilityText: { ...typography.caption, fontWeight: '800' },
  availabilityCompleteText: { color: colors.success },
  availabilityPartialText: { color: colors.brand.action },
  availabilityNoneText: { color: colors.text.muted },
  openLabel: { color: colors.brand.action, ...typography.label, marginTop: spacing.lg },
  stateBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, gap: spacing.md, marginTop: spacing.xl, padding: spacing.xxl },
  stateTitle: { color: colors.text.primary, ...typography.title, textAlign: 'center' },
  stateBody: { color: colors.text.secondary, ...typography.body, textAlign: 'center' },
  author: { color: colors.brand.action, ...typography.label, marginBottom: spacing.sm },
  bookmarkCount: { color: colors.text.secondary, ...typography.label, marginTop: spacing.md, textAlign: 'right' },
  pressed: { opacity: interaction.pressedOpacity },
});
