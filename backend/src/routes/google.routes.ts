import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { db } from "../db";
import { google_integrations, stores, products, customers, suppliers } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getTenantContext, storeStorage } from "../db/context";
import { env } from "../config/env";
import { logger } from "../logger/logger";
import { encryptToken, decryptToken } from "../utils/crypto";
import { settingsRepository } from "../repositories";
import { authenticate } from "../middleware/auth.middleware";
import { GoogleProvisioningService } from "../services/google-provisioning.service";
import { GoogleSyncDispatcher } from "../services/google-sync-dispatcher.service";

const router = Router();

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${env.BASE_URL}/api/google/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// GET /api/google/auth — Initiate OAuth authorization flow
router.get("/auth", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.GOOGLE_OAUTH_ENABLED === "false") {
      res.status(503).json({
        success: false,
        error: "Google OAuth integration is currently disabled (GOOGLE_OAUTH_ENABLED=false).",
      });
      return;
    }

    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      res.status(400).json({
        success: false,
        error: "Google OAuth Client ID & Secret are not configured in backend environment variables. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
      return;
    }

    const { organizationId, currentStoreId, userId } = getTenantContext();
    if (!organizationId || organizationId <= 0) {
      res.status(400).json({ success: false, error: "Authenticated organization context is required" });
      return;
    }

    // Embed authenticated tenant context into state token signed with JWT_SECRET
    const stateToken = jwt.sign(
      { organizationId, currentStoreId, userId },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const scopes = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // Force refresh token issuance
      scope: scopes,
      state: stateToken,
    });

    if (req.headers.accept?.includes("text/html") || req.query.redirect === "true") {
      res.redirect(authUrl);
      return;
    }

    res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    logger.error("Failed to generate Google OAuth auth URL: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/google/callback — Handle Google OAuth redirect callback
router.get("/callback", async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: googleError } = req.query;

    if (googleError) {
      logger.warn(`Google OAuth callback received error: ${googleError}`);
      res.redirect(`${getFrontendUrl(req)}/settings?google_auth=error&reason=${encodeURIComponent(String(googleError))}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send("Invalid callback request: missing code or state parameter.");
      return;
    }

    // Verify state token
    let decodedState: any;
    try {
      decodedState = jwt.verify(String(state), env.JWT_SECRET);
    } catch (jwtErr) {
      logger.error("Failed to verify OAuth state token: " + String(jwtErr));
      res.redirect(`${getFrontendUrl(req)}/settings?google_auth=error&reason=invalid_state`);
      return;
    }

    const { organizationId, currentStoreId, userId } = decodedState;
    if (!organizationId) {
      res.status(400).send("Invalid state payload: missing organizationId.");
      return;
    }

    const oauth2Client = getOAuth2Client();
    if (!oauth2Client) {
      res.status(500).send("Google OAuth Client is not configured on server.");
      return;
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(String(code));
    oauth2Client.setCredentials(tokens);

    // Fetch user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleUserId = userInfo.data.id || "";
    const googleEmail = userInfo.data.email || "";

    // Check if refresh_token was received
    let encryptedRefreshToken = "";
    if (tokens.refresh_token) {
      encryptedRefreshToken = encryptToken(tokens.refresh_token);
    } else {
      // Retain existing refresh token if re-authenticating without prompt
      const [existing] = await db
        .select({ refresh_token: google_integrations.refresh_token })
        .from(google_integrations)
        .where(eq(google_integrations.organization_id, organizationId))
        .limit(1);
      encryptedRefreshToken = existing?.refresh_token || "";
    }

    if (!encryptedRefreshToken) {
      logger.error("No refresh token received from Google OAuth exchange.");
      res.redirect(`${getFrontendUrl(req)}/settings?google_auth=error&reason=missing_refresh_token`);
      return;
    }

    // Insert or update google_integrations row for organizationId
    const [existingIntegration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId))
      .limit(1);

    if (existingIntegration) {
      await db
        .update(google_integrations)
        .set({
          store_id: currentStoreId || existingIntegration.store_id,
          google_user_id: googleUserId,
          google_email: googleEmail,
          refresh_token: encryptedRefreshToken,
          sync_enabled: 1,
          sync_method: "oauth",
          connected_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(google_integrations.id, existingIntegration.id));
    } else {
      await db.insert(google_integrations).values({
        organization_id: organizationId,
        store_id: currentStoreId || null,
        google_user_id: googleUserId,
        google_email: googleEmail,
        refresh_token: encryptedRefreshToken,
        sync_enabled: 1,
        sync_method: "oauth",
        connected_at: new Date(),
      });
    }

    // Set sync_method in settings repository for context
    await storeStorage.run(
      { organizationId, currentStoreId: currentStoreId || 1, userId: userId || 0, role: "admin" },
      async () => {
        await settingsRepository.set("google_sync_method", "oauth");
        await settingsRepository.set("google_sync_enabled", "1");
      }
    );

    logger.info(`✅ Google OAuth connection succeeded for Org ${organizationId} (${googleEmail})`);
    res.redirect(`${getFrontendUrl(req)}/settings?google_auth=success&email=${encodeURIComponent(googleEmail)}`);
  } catch (error: any) {
    logger.error("Google OAuth callback processing error: " + error.message);
    res.redirect(`${getFrontendUrl(req)}/settings?google_auth=error&reason=${encodeURIComponent(error.message)}`);
  }
});

// GET /api/google/status — Retrieve Google Workspace integration status
router.get("/status", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = getTenantContext();
    if (!organizationId || organizationId <= 0) {
      const disconnected = { connected: false, email: "", spreadsheetName: "", spreadsheetId: "", lastSync: "Never", syncMethod: "service_account" };
      res.status(200).json({ success: true, ...disconnected, data: disconnected });
      return;
    }

    const [integration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId))
      .limit(1);

    const legacySheetId = await settingsRepository.get("google_sheet_id", "");
    const legacyEnabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
    const configuredMethod = await settingsRepository.get("google_sync_method", integration?.sync_method || "oauth");

    if (integration && integration.refresh_token) {
      const connectedPayload = {
        connected: true,
        email: integration.google_email || "",
        userId: integration.google_user_id || "",
        spreadsheetId: integration.spreadsheet_id || legacySheetId || "",
        spreadsheetName: integration.spreadsheet_name || "",
        syncEnabled: integration.sync_enabled === 1,
        syncMethod: configuredMethod,
        lastSync: integration.last_sync ? integration.last_sync.toISOString() : "Never",
        connectedAt: integration.connected_at ? integration.connected_at.toISOString() : null,
      };
      res.status(200).json({
        success: true,
        ...connectedPayload,
        data: connectedPayload,
      });
      return;
    }

    const disconnectedPayload = {
      connected: false,
      email: "",
      spreadsheetId: legacySheetId || "",
      spreadsheetName: "",
      syncEnabled: legacyEnabled,
      syncMethod: configuredMethod || "service_account",
      lastSync: "Never",
    };

    res.status(200).json({
      success: true,
      ...disconnectedPayload,
      data: disconnectedPayload,
    });
  } catch (error: any) {
    logger.error("Error fetching Google status: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/google/spreadsheets — List spreadsheets from user's Google Drive API
router.get("/spreadsheets", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = getTenantContext();
    const [integration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId))
      .limit(1);

    if (!integration || !integration.refresh_token) {
      res.status(400).json({
        success: false,
        error: "Google account is not connected. Please connect your Google Workspace account first.",
      });
      return;
    }

    const refreshToken = decryptToken(integration.refresh_token);
    const oauth2Client = getOAuth2Client();

    if (!oauth2Client) {
      res.status(400).json({
        success: false,
        error: "Google OAuth credentials are not configured on server.",
      });
      return;
    }

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id, name, webViewLink, modifiedTime)",
      pageSize: 100,
      orderBy: "modifiedTime desc",
    });

    const files = (response.data.files || []).map((f) => ({
      id: f.id || "",
      name: f.name || "Untitled Spreadsheet",
      modifiedTime: f.modifiedTime || null,
      webViewLink: f.webViewLink || null,
    }));

    res.status(200).json({
      success: true,
      data: files,
    });
  } catch (error: any) {
    logger.error("Failed to list Google Spreadsheets: " + error.message);
    res.status(500).json({
      success: false,
      error: `Failed to fetch Google Spreadsheets: ${error.message}`,
    });
  }
});

// POST /api/google/spreadsheet & /api/google/select-spreadsheet — Verify and save chosen spreadsheet ID & name
const saveSpreadsheetHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = getTenantContext();
    const { spreadsheetId, spreadsheetName: inputName } = req.body;

    if (!spreadsheetId) {
      res.status(400).json({ success: false, error: "spreadsheetId is required" });
      return;
    }

    const [integration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId))
      .limit(1);

    if (!integration || !integration.refresh_token) {
      res.status(400).json({ success: false, error: "No Google Workspace integration found for this organization." });
      return;
    }

    let resolvedName = inputName || "Selected Spreadsheet";
    // Verify spreadsheet exists via Google Drive API
    try {
      const refreshToken = decryptToken(integration.refresh_token);
      const oauth2Client = getOAuth2Client();
      if (oauth2Client && refreshToken) {
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const fileRes = await drive.files.get({ fileId: spreadsheetId, fields: "id, name" });
        if (fileRes.data && fileRes.data.name) {
          resolvedName = fileRes.data.name;
        }
      }
    } catch (verifyErr: any) {
      logger.warn(`Drive API spreadsheet lookup notice for ${spreadsheetId}: ${verifyErr.message}`);
    }

    await db
      .update(google_integrations)
      .set({
        spreadsheet_id: spreadsheetId,
        spreadsheet_name: resolvedName,
        updated_at: new Date(),
      })
      .where(eq(google_integrations.id, integration.id));

    await settingsRepository.set("google_sheet_id", spreadsheetId);

    logger.info(`✅ Selected Google Spreadsheet "${resolvedName}" (${spreadsheetId}) for Org ${organizationId}`);

    // Phase 3: Automatically provision missing worksheets & headers
    let provisioningResult = null;
    try {
      const refreshToken = decryptToken(integration.refresh_token);
      const oauth2Client = getOAuth2Client();
      if (oauth2Client && refreshToken) {
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const sheetsClient = google.sheets({ version: "v4", auth: oauth2Client });
        provisioningResult = await GoogleProvisioningService.provisionSpreadsheet(sheetsClient, spreadsheetId);
      }
    } catch (provErr: any) {
      logger.warn(`Spreadsheet provisioning notice for ${spreadsheetId}: ${provErr.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Spreadsheet configured and provisioned successfully",
      spreadsheetId,
      spreadsheetName: resolvedName,
      provisioning: provisioningResult,
      data: { spreadsheetId, spreadsheetName: resolvedName, provisioning: provisioningResult },
    });
  } catch (error: any) {
    logger.error("Error selecting Google Spreadsheet: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.post("/spreadsheet", authenticate(), saveSpreadsheetHandler);
router.post("/select-spreadsheet", authenticate(), saveSpreadsheetHandler);

// POST /api/google/disconnect — Disconnect Google account
router.post("/disconnect", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = getTenantContext();

    await db
      .delete(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId));

    await settingsRepository.set("google_sync_method", "service_account");

    logger.info(`✅ Disconnected Google Workspace for Org ${organizationId}`);
    res.status(200).json({
      success: true,
      message: "Google Workspace account disconnected successfully",
    });
  } catch (error: any) {
    logger.error("Error disconnecting Google account: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/google/sync-method — Toggle Google sync method (oauth vs service_account)
router.post("/sync-method", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = getTenantContext();
    const { syncMethod } = req.body;

    if (!["oauth", "service_account"].includes(syncMethod)) {
      res.status(400).json({ success: false, error: "Invalid syncMethod. Must be 'oauth' or 'service_account'." });
      return;
    }

    const [integration] = await db
      .select()
      .from(google_integrations)
      .where(eq(google_integrations.organization_id, organizationId))
      .limit(1);

    if (integration) {
      await db
        .update(google_integrations)
        .set({
          sync_method: syncMethod,
          updated_at: new Date(),
        })
        .where(eq(google_integrations.id, integration.id));
    }

    await settingsRepository.set("google_sync_method", syncMethod);

    res.status(200).json({
      success: true,
      message: `Google sync method set to ${syncMethod}`,
      syncMethod,
    });
  } catch (error: any) {
    logger.error("Error updating sync method: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/google/sync-now — Perform manual idempotent bulk sync of Products, Customers, Suppliers, and Inventory
router.post("/sync-now", authenticate(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, currentStoreId } = getTenantContext();

    if (!organizationId || organizationId <= 0) {
      res.status(400).json({ success: false, error: "Authenticated organization context is required" });
      return;
    }

    // 1. Load active products for org
    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.organization_id, organizationId));

    // 2. Load customers for org
    const allCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.organization_id, organizationId));

    // 3. Load suppliers for org
    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.organization_id, organizationId));

    // Async dispatch snapshot sync events (non-blocking, idempotent)
    for (const p of allProducts) {
      GoogleSyncDispatcher.dispatchSyncEvent("PRODUCT_UPDATED", p, { organizationId, storeId: currentStoreId });
      GoogleSyncDispatcher.dispatchSyncEvent("INVENTORY_ADJUSTED", p, { organizationId, storeId: currentStoreId });
    }

    for (const c of allCustomers) {
      GoogleSyncDispatcher.dispatchSyncEvent("CUSTOMER_UPDATED", c, { organizationId, storeId: currentStoreId });
    }

    for (const s of allSuppliers) {
      GoogleSyncDispatcher.dispatchSyncEvent("SUPPLIER_CREATED", s, { organizationId, storeId: currentStoreId });
    }

    logger.info(`✅ Manual Sync Now triggered for Org ${organizationId}: ${allProducts.length} products, ${allCustomers.length} customers, ${allSuppliers.length} suppliers queued.`);

    res.status(200).json({
      success: true,
      message: "Manual sync triggered successfully. PostgreSQL snapshot queued for idempotent update.",
      stats: {
        products: allProducts.length,
        customers: allCustomers.length,
        suppliers: allSuppliers.length,
        inventory: allProducts.length,
      },
    });
  } catch (error: any) {
    logger.error("Error triggering manual sync: " + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function getFrontendUrl(req: Request): string {
  const referer = req.headers.referer || req.headers.origin;
  if (referer) {
    try {
      const u = new URL(String(referer));
      return `${u.protocol}//${u.host}`;
    } catch (e) {}
  }
  const origins = (env.ALLOWED_ORIGINS || "").split(",");
  return origins[0] || "http://localhost:3000";
}

export default router;
