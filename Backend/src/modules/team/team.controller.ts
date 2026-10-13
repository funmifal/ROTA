import { Request, Response } from 'express';
import { TeamService } from './team.service';
import { validateCreateInvitationInput, validateUpdateMemberInput } from './team.validation';

export class TeamController {
  static async listMembers(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;
      const members = await TeamService.listMembers(businessId);
      res.status(200).json({ members });
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

  static async updateMember(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
        return;
      }

      const { businessId, memberId } = req.params;
      const input = validateUpdateMemberInput(req.body);
      const member = await TeamService.updateMember(businessId, memberId, req.user.id, input);

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
