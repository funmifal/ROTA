import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember } from '../../middleware/rbac';
import { SwapController } from './swap.controller';

const router = Router({ mergeParams: true });

router.post(
  '/swaps',
  requireAuth,
  requireBusinessMember,
  SwapController.requestSwap
);

router.get(
  '/swaps',
  requireAuth,
  requireBusinessMember,
  SwapController.getSwaps
);

export default router;
