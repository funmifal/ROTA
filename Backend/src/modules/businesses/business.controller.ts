import { Request, Response } from 'express';
import { BusinessService } from './business.service';
import { validateCreateBusinessInput, validateUpdateBusinessInput } from './business.validation';

export class BusinessController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const input = validateCreateBusinessInput(req.body);
      const business = await BusinessService.createBusiness(req.user.id, input);

      res.status(201).json({
        message: 'Business successfully created.',
        business,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to create business.',
      });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const businesses = await BusinessService.getUserBusinesses(req.user.id);
      res.status(200).json({ businesses });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to retrieve businesses.',
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const business = await BusinessService.getBusinessById(businessId);
      res.status(200).json({ business });
    } catch (err: any) {
      res.status(404).json({
        error: 'NotFound',
        message: err.message || 'Business not found.',
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId } = req.params;
      const input = validateUpdateBusinessInput(req.body);
      const business = await BusinessService.updateBusiness(businessId, req.user.id, input);

      res.status(200).json({
        message: 'Business details updated successfully.',
        business,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to update business.',
      });
    }
  }
}
