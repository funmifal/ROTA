import { Request, Response } from 'express';
import { ActivityService } from './activity.service';

export class ActivityController {
  static async getFeed(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const feed = await ActivityService.getActivityFeed(businessId, {
        cursor,
        limit: isNaN(limit) ? 20 : limit,
      });

      res.status(200).json(feed);
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: err.message || 'Failed to retrieve activity feed.',
      });
    }
  }
}
