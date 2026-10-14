import { Request, Response } from 'express';
import { ActivityService } from './activity.service';
import { CacheService } from '../../services/cache.service';

export class ActivityController {
  static async getFeed(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const parsedLimit = isNaN(limit) ? 20 : limit;

      // Cache page 1 (initial scroll) in Redis for 60 seconds
      const isPage1 = !cursor;
      const cacheKey = `cache:activity:${businessId}:page1:limit:${parsedLimit}`;

      if (isPage1) {
        const cachedFeed = await CacheService.get(cacheKey);
        if (cachedFeed) {
          res.setHeader('X-Cache-Status', 'HIT');
          res.status(200).json(cachedFeed);
          return;
        }
      }

      const feed = await ActivityService.getActivityFeed(businessId, {
        cursor,
        limit: parsedLimit,
      });

      if (isPage1) {
        await CacheService.set(cacheKey, feed, 60);
      }

      res.setHeader('X-Cache-Status', 'MISS');
      res.status(200).json(feed);
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: err.message || 'Failed to retrieve activity feed.',
      });
    }
  }
}
