import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { TeamController } from './team.controller';

const router = Router();

// Publicly preview invitation details
router.get('/:token', TeamController.getInvitationByToken);

// Accept invitation (requires authenticated account)
router.post('/:token/accept', requireAuth, TeamController.acceptInvitation);

export default router;
