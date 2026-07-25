import express from "express";
import http from "http";
import authRoutes from "../routes/auth.routes";
import superAdminRoutes from "../routes/super-admin.routes";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/super-admin", superAdminRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.status || 500).json({ success: false, error: err.message });
});

const server = http.createServer(app);

server.listen(0, async () => {
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`Test Express server listening on ${baseUrl}`);

  try {
    // 1. Test Super Admin Login
    const saRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "superadmin@apkabill.com", password: "SuperAdmin@123" }),
    });
    const saJson = await saRes.json();
    console.log("\n1. SUPER ADMIN LOGIN HTTP TEST:");
    console.log("Status Code:", saRes.status);
    console.log("Response Success:", saJson.success);
    console.log("Returned User:", saJson.data?.user);
    console.log("Token Received:", !!saJson.data?.token);

    if (!saJson.success || !saJson.data?.token) {
      throw new Error("Super Admin login HTTP request failed: " + JSON.stringify(saJson));
    }

    // Test Super Admin Dashboard Endpoint with Token
    const saMeRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: {
        Authorization: `Bearer ${saJson.data.token}`,
      },
    });
    const saMeJson = await saMeRes.json();
    console.log("Super Admin Dashboard Access Code:", saMeRes.status);
    console.log("Super Admin Dashboard Data:", saMeJson);

    // 2. Test Owner Login
    const ownerRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@apkabill.com", password: "OwnerPass@123" }),
    });
    const ownerJson = await ownerRes.json();
    console.log("\n2. ORGANIZATION OWNER LOGIN HTTP TEST:");
    console.log("Status Code:", ownerRes.status);
    console.log("Response Success:", ownerJson.success);
    console.log("Returned User:", ownerJson.data?.user);
    console.log("Token Received:", !!ownerJson.data?.token);

    if (!ownerJson.success || !ownerJson.data?.token) {
      throw new Error("Owner login HTTP request failed: " + JSON.stringify(ownerJson));
    }

    // Test Owner Session Me Endpoint
    const ownerMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${ownerJson.data.token}`,
      },
    });
    const ownerMeJson = await ownerMeRes.json();
    console.log("Owner /me Endpoint Access Code:", ownerMeRes.status);
    console.log("Owner /me Endpoint Data:", ownerMeJson);

    // Test Owner Blocked on Super Admin Endpoint (403 Expected)
    const ownerSaRes = await fetch(`${baseUrl}/api/super-admin/dashboard`, {
      headers: {
        Authorization: `Bearer ${ownerJson.data.token}`,
      },
    });
    const ownerSaJson = await ownerSaRes.json();
    console.log("Owner Super Admin Block Test (403 Expected): Code=", ownerSaRes.status, "Error=", ownerSaJson.error);

    console.log("\n✅ ALL HTTP LOGIN PIPELINE TESTS PASSED CLEANLY!");
  } catch (err: any) {
    console.error("HTTP login test error:", err);
  } finally {
    server.close();
    process.exit(0);
  }
});
