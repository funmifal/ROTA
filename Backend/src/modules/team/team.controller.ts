import { Request, Response } from 'express';
import { TeamService } from './team.service';
import { validateCreateInvitationInput, validateUpdateMemberInput } from './team.validation';
import { CacheService } from '../../services/cache.service';

export class TeamController {
  static async listMembers(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const cacheKey = `cache:roster:${businessId}`;

      const { data: members, cached } = await CacheService.getOrSet(
        cacheKey,
        300,
        () => TeamService.listMembers(businessId)
      );

      res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');
      res.status(200).json({ members, cached });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: err.message || 'Failed to list team members.',
      });
    }
  }

  static async createInvitation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.membership) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId } = req.params;
      const input = validateCreateInvitationInput(req.body);

      const result = await TeamService.createInvitation(
        businessId,
        req.user.id,
        req.membership.role,
        input
      );

      res.status(201).json({
        message: `Invitation successfully sent to ${input.email}.`,
        invitation: result.invitation,
        inviteUrl: result.inviteUrl,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to create invitation.',
      });
    }
  }

  static async listInvitations(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const invitations = await TeamService.listInvitations(businessId);
      res.status(200).json({ invitations });
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: err.message || 'Failed to list invitations.',
      });
    }
  }

  static async revokeInvitation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId, invitationId } = req.params;
      await TeamService.revokeInvitation(businessId, invitationId, req.user.id);

      res.status(200).json({
        message: 'Invitation successfully revoked.',
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to revoke invitation.',
      });
    }
  }

  static async getInvitationByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const invitation = await TeamService.getInvitationByToken(token);
      res.status(200).json({ invitation });
    } catch (err: any) {
      res.status(404).json({
        error: 'NotFound',
        message: err.message || 'Invitation not found.',
      });
    }
  }

  static async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { token } = req.params;
      const result = await TeamService.acceptInvitation(token, req.user.id);

      res.status(200).json({
        message: `Successfully joined ${result.businessName}!`,
        membership: result,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to accept invitation.',
      });
    }
  }

  static async signUpWithInvitation(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { name, password } = req.body;

      if (!name || !password) {
        res.status(400).json({ error: 'ValidationError', message: 'Name and password are required.' });
        return;
      }

      const result = await TeamService.signUpWithInvitation(token, { name, password });
      res.status(201).json({
        message: `Welcome to ${result.business.name}! Your account has been created and joined to the team.`,
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to complete sign-up with invitation.',
      });
    }
  }

  static async updateMember(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId, memberId } = req.params;
      const input = validateUpdateMemberInput(req.body);
      const member = await TeamService.updateMember(businessId, memberId, req.user.id, input);

      // Invalidate team roster cache upon role/status mutation
      await CacheService.del(`cache:roster:${businessId}`);

      res.status(200).json({
        message: 'Team member updated successfully.',
        member,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to update member.',
      });
    }
  }

  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.membership) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId, memberId } = req.params;
      await TeamService.removeMember(businessId, memberId, req.user.id, req.membership.role);

      // Invalidate team roster cache upon member removal
      await CacheService.del(`cache:roster:${businessId}`);

      res.status(200).json({
        message: 'Team member removed from business.',
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to remove member.',
      });
    }
  }
}
