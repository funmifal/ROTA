import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { updateSettingsSchema } from './settings.validation';
import { SettingsController } from './settings.controller';

const router = Router();

router.get('/', requireAuth, SettingsController.getSettings);
router.put('/', requireAuth, validateBody(updateSettingsSchema), SettingsController.updateSettings);
router.patch('/', requireAuth, validateBody(updateSettingsSchema), SettingsController.updateSettings);

export default router;
