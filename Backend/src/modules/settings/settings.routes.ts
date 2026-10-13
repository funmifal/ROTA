import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { SettingsController } from './settings.controller';

const router = Router();

router.get('/', requireAuth, SettingsController.getSettings);
router.put('/', requireAuth, SettingsController.updateSettings);
router.patch('/', requireAuth, SettingsController.updateSettings);

export default router;
