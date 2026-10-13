import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Effects } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { FeedbackBanner } from '../../components/FeedbackBanner';
import { api, ActivityFeedItem, Business } from '../../services/api';

interface ActivityFeedScreenProps {
  business: Business;
  onBack: () => void;
}

/**
 * Architectural Note on FlatList vs FlashList:
 * FlatList is used here because:
 * 1. React Native 0.86 & React 19 compatibility: @shopify/flash-list currently emits peer dependency
 *    warnings with React 19 / RN 0.86 in modern Expo projects.
 * 2. FlatList is built natively into React Native with zero external binary link dependencies.
 * 3. With proper windowing optimizations (initialNumToRender={15}, maxToRenderPerBatch={10}, windowSize={5},
 *    removeClippedSubviews={Platform.OS !== 'web'}), FlatList delivers 60 FPS scrolling with minimal memory footprint.
 */
export const ActivityFeedScreen: React.FC<ActivityFeedScreenProps> = ({
  business,
  onBack,
}) => {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Critical concurrency guard: prevents duplicate requests when scrolling fast
  const isFetchingRef = useRef(false);

  const fetchFeed = useCallback(async (cursor?: string, isRefresh: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setError('');
      } else if (!cursor) {
        setInitialLoading(true);
        setError('');
      } else {
        setLoadingMore(true);
      }

      const res = await api.getActivityFeed(business.id, {
        cursor,
        limit: 20,
      });

      if (isRefresh || !cursor) {
        setItems(res.items);
      } else {
        // Append items avoiding any accidental duplicates
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = res.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newItems];
        });
      }

      setNextCursor(res.nextCursor);
      setHasNextPage(res.hasNextPage);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity feed.');
    } finally {
      isFetchingRef.current = false;
      setInitialLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [business.id]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleRefresh = () => {
    fetchFeed(undefined, true);
  };

  const handleLoadMore = () => {
    // Guard against fetching if already in flight or if end of list reached
    if (isFetchingRef.current || !hasNextPage || !nextCursor || initialLoading || loadingMore) {
      return;
    }
    fetchFeed(nextCursor);
  };

  const formatActivityTitle = (action: string, resource: string) => {
    const formattedAction = action.replace(/_/g, ' ').toLowerCase();
    return formattedAction.charAt(0).toUpperCase() + formattedAction.slice(1);
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('SHIFT')) return 'calendar';
    if (action.includes('SWAP')) return 'swap-horizontal';
    if (action.includes('MEMBER') || action.includes('INVITATION')) return 'people';
    if (action.includes('BUSINESS')) return 'business';
    return 'notifications';
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerText}>Loading more activity...</Text>
        </View>
      );
    }

    if (!hasNextPage && items.length > 0) {
      return (
        <View style={styles.endOfListContainer}>
          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.neutral} />
          <Text style={styles.endOfListText}>You're all caught up! No more activity.</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Activity Feed</Text>
          <Text style={styles.subtitle}>{business.name}</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="reload" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBannerContainer}>
          <FeedbackBanner type="error" message={error} />
          <Button
            title="Retry"
            onPress={() => fetchFeed(nextCursor || undefined)}
            variant="tonal"
            style={{ marginTop: 8 }}
          />
        </View>
      ) : null}

      {initialLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={48} color={Colors.neutral} />
              <Text style={styles.emptyTitle}>No Activity Yet</Text>
              <Text style={styles.emptySubtitle}>
                Events like shift assignments, published schedules, and team updates will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={getActivityIcon(item.action) as any}
                  size={20}
                  color={Colors.primary}
                />
              </View>

              <View style={styles.itemContent}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemTitle}>
                    {formatActivityTitle(item.action, item.resource)}
                  </Text>
                  <Text style={styles.itemTimestamp}>{formatDate(item.createdAt)}</Text>
                </View>

                {item.metadata?.note ? (
                  <Text style={styles.itemDescription}>{item.metadata.note}</Text>
                ) : item.metadata?.details ? (
                  <Text style={styles.itemDescription}>{item.metadata.details}</Text>
                ) : (
                  <Text style={styles.itemDescription}>
                    {item.resource} ({item.action})
                  </Text>
                )}

                {item.user ? (
                  <Text style={styles.itemUser}>By: {item.user.name}</Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.baseSpacing,
    paddingTop: Spacing.largeSpacing,
    paddingBottom: Spacing.mediumSpacing,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainer,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: Typography.headlineSmall.fontSize,
    lineHeight: Typography.headlineSmall.lineHeight,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  subtitle: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  refreshButton: {
    padding: 8,
  },
  errorBannerContainer: {
    padding: Spacing.baseSpacing,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.smallSpacing,
    fontSize: Typography.bodyMedium.fontSize,
    color: Colors.neutral,
  },
  listContent: {
    padding: Spacing.baseSpacing,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.mediumSpacing,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    ...Effects.softShadow,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.mediumSpacing,
  },
  itemContent: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: Typography.titleSmall.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  itemTimestamp: {
    fontSize: 11,
    color: Colors.neutral,
  },
  itemDescription: {
    fontSize: Typography.bodySmall.fontSize,
    lineHeight: Typography.bodySmall.lineHeight,
    color: Colors.neutral,
  },
  itemUser: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.baseSpacing,
    gap: 8,
  },
  footerText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  endOfListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.largeSpacing,
    gap: 6,
  },
  endOfListText: {
    fontSize: Typography.bodySmall.fontSize,
    color: Colors.neutral,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.largeSpacing,
  },
  emptyTitle: {
    fontSize: Typography.titleMedium.fontSize,
    fontWeight: '600',
    color: Colors.onSurface,
    marginTop: Spacing.mediumSpacing,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: Typography.bodyMedium.fontSize,
    color: Colors.neutral,
    textAlign: 'center',
  },
});
