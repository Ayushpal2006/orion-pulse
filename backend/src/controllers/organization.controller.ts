import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizations, organization_invitations, users, stores, api_keys, support_tickets } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError, NotFoundError } from "../utils/errors";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export class OrganizationController {
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, billingPlan } = req.body;
      if (!name) {
        throw new ValidationError("Organization name is required");
      }

      const [org] = await db
        .insert(organizations)
        .values({
          name,
          billing_plan: billingPlan || "Basic",
          subscription_status: "active",
        })
        .returning();

      res.status(201).json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  };

  inviteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, role } = req.body;
      if (!email) {
        throw new ValidationError("Invite email is required");
      }

      // Hardcoded or fetched context org
      const storeId = getStoreId() || 1;
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours expiry

      const [invitation] = await db
        .insert(organization_invitations)
        .values({
          organization_id: 1, // default organization context
          email,
          role: role || "Manager",
          token,
          status: "pending",
          expires_at: expiresAt,
        })
        .returning();

      res.status(201).json({
        success: true,
        message: "Invitation generated successfully",
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          expiresAt: invitation.expires_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, name, password } = req.body;
      if (!token || !name || !password) {
        throw new ValidationError("Token, name, and password are required to accept invitation");
      }

      const [invite] = await db
        .select()
        .from(organization_invitations)
        .where(and(eq(organization_invitations.token, token), eq(organization_invitations.status, "pending")))
        .limit(1);

      if (!invite) {
        throw new NotFoundError("Invitation token is invalid or already accepted");
      }

      if (invite.expires_at < new Date()) {
        await db
          .update(organization_invitations)
          .set({ status: "expired" })
          .where(eq(organization_invitations.id, invite.id));
        throw new ValidationError("Invitation token has expired");
      }

      // Password hashing
      const passwordHash = await bcrypt.hash(password, 10);

      await db.transaction(async (tx) => {
        // Create user
        await tx.insert(users).values({
          name,
          email: invite.email,
          password_hash: passwordHash,
          role: invite.role,
          store_id: 1, // bind to default store
          is_active: 1,
        });

        // Mark invite accepted
        await tx
          .update(organization_invitations)
          .set({ status: "accepted" })
          .where(eq(organization_invitations.id, invite.id));
      });

      res.status(200).json({ success: true, message: "Invitation accepted successfully. Account created." });
    } catch (error) {
      next(error);
    }
  };

  createApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const { name, scopes } = req.body;
      if (!name) {
        throw new ValidationError("API Key name is required");
      }

      const rawKey = "op_live_" + crypto.randomBytes(24).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const prefix = rawKey.substring(0, 12);

      const [apiKey] = await db
        .insert(api_keys)
        .values({
          organization_id: 1,
          store_id: storeId,
          name,
          key_hash: keyHash,
          prefix,
          scopes: scopes || "read:sales",
          is_active: 1,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          scopes: apiKey.scopes,
          apiKey: rawKey, // only visible once
          createdAt: apiKey.created_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listApiKeys = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const keys = await db
        .select()
        .from(api_keys)
        .where(and(eq(api_keys.store_id, storeId), eq(api_keys.is_active, 1)));

      res.status(200).json({ success: true, data: keys });
    } catch (error) {
      next(error);
    }
  };

  deleteApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const storeId = getStoreId() || 1;
      if (isNaN(id)) {
        throw new ValidationError("Invalid API Key ID");
      }

      await db
        .update(api_keys)
        .set({ is_active: 0 })
        .where(and(eq(api_keys.id, id), eq(api_keys.store_id, storeId)));

      res.status(200).json({ success: true, message: "API key deactivated successfully" });
    } catch (error) {
      next(error);
    }
  };

  createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const { subject, description, priority } = req.body;
      if (!subject || !description) {
        throw new ValidationError("Subject and description are required for support tickets");
      }

      const [ticket] = await db
        .insert(support_tickets)
        .values({
          organization_id: 1,
          store_id: storeId,
          subject,
          description,
          status: "Open",
          priority: priority || "Medium",
        })
        .returning();

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  };

  listTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId() || 1;
      const tickets = await db
        .select()
        .from(support_tickets)
        .where(eq(support_tickets.store_id, storeId));

      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  };
}
