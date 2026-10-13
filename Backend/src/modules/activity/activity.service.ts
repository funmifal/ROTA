import { prisma } from '../../database/prisma';

export interface CursorPayload {
  createdAt: Date;
  id: string;
}

export interface ActivityFeedItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface PaginatedActivityResponse {
  items: ActivityFeedItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export class ActivityService {
  /**
   * Encodes createdAt timestamp and id into a URL-safe, opaque base64 cursor string.
   */
  static encodeCursor(createdAt: Date, id: string): string {
    const raw = `${createdAt.toISOString()}|${id}`;
    return Buffer.from(raw).toString('base64url');
  }

  /**
   * Decodes an opaque base64 cursor string into createdAt timestamp and id.
   */
  static decodeCursor(cursorStr: string): CursorPayload | null {
    try {
      const decoded = Buffer.from(cursorStr, 'base64url').toString('utf-8');
      const [isoDate, id] = decoded.split('|');
      if (!isoDate || !id) return null;
      const createdAt = new Date(isoDate);
      if (isNaN(createdAt.getTime())) return null;
      return { createdAt, id };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves a page of activity feed items using deterministic cursor pagination.
   * Uses compound ordering [createdAt DESC, id DESC] with tie-breaking so items with
   * identical timestamps are never skipped or duplicated.
   */
  static async getActivityFeed(
    businessId: string,
    options: { cursor?: string; limit?: number } = {}
  ): Promise<PaginatedActivityResponse> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const decodedCursor = options.cursor ? this.decodeCursor(options.cursor) : null;

    // Build cursor filter: items older than cursor
    // If createdAt is strictly older, OR if createdAt matches exactly and id is strictly smaller
    const cursorFilter = decodedCursor
      ? {
          OR: [
            { createdAt: { lt: decodedCursor.createdAt } },
            {
              createdAt: decodedCursor.createdAt,
              id: { lt: decodedCursor.id },
            },
          ],
        }
      : {};

    const rawItems = await prisma.auditLog.findMany({
      where: {
        businessId,
        ...cursorFilter,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1, // Fetch limit + 1 to check if another page exists without a COUNT query
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const hasNextPage = rawItems.length > limit;
    const pageItems = hasNextPage ? rawItems.slice(0, limit) : rawItems;

    let nextCursor: string | null = null;
    if (hasNextPage && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
    }

    const items: ActivityFeedItem[] = pageItems.map((item) => ({
      id: item.id,
      action: item.action,
      resource: item.resource,
      resourceId: item.resourceId,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
      user: item.user,
    }));

    return {
      items,
      nextCursor,
      hasNextPage,
      limit,
    };
  }
}
