import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import { createRecipeComment, deleteRecipeComment, getRecipeComments, updateRecipeComment } from './communityApi';
import { RecipeComment } from './types';

export function RecipeComments({ initialCount, onComposerFocus, onCountChange, recipePostId }: {
  initialCount: number;
  onComposerFocus(): void;
  onCountChange(count: number): void;
  recipePostId: string;
}) {
  const [comments, setComments] = useState<RecipeComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>();
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editingContent, setEditingContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [workingId, setWorkingId] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const page = await getRecipeComments(recipePostId);
      setComments(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [recipePostId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const value = content.trim();
    if (!value || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const created = await createRecipeComment(recipePostId, value);
      setComments((current) => [created, ...current]);
      setContent('');
      onCountChange(initialCount + 1);
    } catch (error) {
      Alert.alert('댓글을 등록하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getRecipeComments(recipePostId, nextCursor);
      setComments((current) => [...current, ...page.items.filter((item) => !current.some(({ id }) => id === item.id))]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('댓글을 더 불러오지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const saveEdit = async (comment: RecipeComment) => {
    const value = editingContent.trim();
    if (!value || workingId) return;
    setWorkingId(comment.id);
    try {
      const updated = await updateRecipeComment(comment.id, value);
      setComments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(undefined);
      setEditingContent('');
    } catch (error) {
      Alert.alert('댓글을 수정하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setWorkingId(undefined);
    }
  };

  const confirmDelete = (comment: RecipeComment) => {
    Alert.alert('댓글을 삭제할까요?', '삭제한 댓글은 복구할 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        setWorkingId(comment.id);
        try {
          await deleteRecipeComment(comment.id);
          setComments((current) => current.filter(({ id }) => id !== comment.id));
          onCountChange(Math.max(0, initialCount - 1));
        } catch (error) {
          Alert.alert('댓글을 삭제하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
        } finally { setWorkingId(undefined); }
      } },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>댓글 {initialCount}</Text>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="댓글 입력"
          editable={!isSubmitting}
          maxLength={500}
          multiline
          onChangeText={setContent}
          onFocus={onComposerFocus}
          placeholder="레시피에 대한 댓글을 남겨보세요"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          value={content}
        />
        <Text style={styles.length}>{content.length}/500</Text>
        <Button disabled={!content.trim()} label="댓글 등록" loading={isSubmitting} onPress={() => void submit()} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.brand.action} style={styles.loader} /> : errorMessage ? (
        <View style={styles.state}><Text style={styles.error}>{errorMessage}</Text><Button label="다시 불러오기" onPress={() => void load()} variant="secondary" /></View>
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>아직 댓글이 없어요. 첫 댓글을 남겨보세요.</Text>
      ) : (
        <View style={styles.list}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <View style={styles.header}>
                <Text style={styles.author}>@{comment.author.nickname}</Text>
                <Text style={styles.date}>{formatCommentDate(comment.createdAt)}{comment.updatedAt !== comment.createdAt ? ' · 수정됨' : ''}</Text>
              </View>
              {editingId === comment.id ? (
                <View style={styles.editBox}>
                  <TextInput maxLength={500} multiline onChangeText={setEditingContent} style={styles.editInput} value={editingContent} />
                  <View style={styles.editActions}>
                    <Button disabled={Boolean(workingId)} label="취소" onPress={() => setEditingId(undefined)} style={styles.actionButton} variant="ghost" />
                    <Button disabled={!editingContent.trim()} label="저장" loading={workingId === comment.id} onPress={() => void saveEdit(comment)} style={styles.actionButton} />
                  </View>
                </View>
              ) : (
                <Text style={styles.content}>{comment.content}</Text>
              )}
              {comment.canDelete && editingId !== comment.id && (
                <View style={styles.ownerActions}>
                  {comment.isOwn && <Pressable onPress={() => { setEditingId(comment.id); setEditingContent(comment.content); }}><Text style={styles.editAction}>수정</Text></Pressable>}
                  <Pressable disabled={Boolean(workingId)} onPress={() => confirmDelete(comment)}><Text style={styles.deleteAction}>삭제</Text></Pressable>
                </View>
              )}
            </View>
          ))}
          {nextCursor && <Button label="댓글 더 보기" loading={isLoadingMore} onPress={() => void loadMore()} variant="secondary" />}
        </View>
      )}
    </View>
  );
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  section: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.xxl, paddingTop: spacing.xxl },
  title: { color: colors.text.primary, ...typography.heading2 },
  composer: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  input: { color: colors.text.primary, minHeight: 76, textAlignVertical: 'top', ...typography.body },
  length: { color: colors.text.muted, ...typography.caption, marginBottom: spacing.sm, textAlign: 'right' },
  loader: { marginVertical: spacing.xxl },
  state: { gap: spacing.md, marginTop: spacing.xl },
  error: { color: colors.danger, ...typography.body },
  empty: { color: colors.text.muted, ...typography.body, marginTop: spacing.xl, textAlign: 'center' },
  list: { gap: spacing.md, marginTop: spacing.lg },
  comment: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  author: { color: colors.brand.action, ...typography.label },
  date: { color: colors.text.muted, ...typography.caption },
  content: { color: colors.text.primary, ...typography.body, marginTop: spacing.sm },
  ownerActions: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'flex-end', marginTop: spacing.md },
  editAction: { color: colors.brand.action, ...typography.label, minHeight: interaction.minimumTouchSize },
  deleteAction: { color: colors.danger, ...typography.label, minHeight: interaction.minimumTouchSize },
  editBox: { marginTop: spacing.sm },
  editInput: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.medium, borderWidth: 1, color: colors.text.primary, minHeight: 72, padding: spacing.md, textAlignVertical: 'top', ...typography.body },
  editActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm },
  actionButton: { minWidth: 88 },
});
