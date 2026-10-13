import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireBusinessMember } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { requestSwapSchema } from './swap.validation';
import { SwapController } from './swap.controller';

const router = Router({ mergeParams: true });

router.post(
  '/swaps',
  requireAuth,
  requireBusinessMember,
  validateBody(requestSwapSchema),
  SwapController.requestSwap
);

router.get(
  '/swaps',
  requireAuth,
  requireBusinessMember,
  SwapController.getSwaps
);

export default router;
