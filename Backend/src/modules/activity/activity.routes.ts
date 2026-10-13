import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember } from '../../middleware/rbac';
import { ActivityController } from './activity.controller';

const router = Router({ mergeParams: true });

// Cursor-paginated activity feed for business members
router.get(
  '/activity',
  requireAuth,
  requireBusinessMember,
  ActivityController.getFeed
);

export default router;
