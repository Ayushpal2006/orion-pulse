import express from "express";
import http from "http";
import authRoutes from "../routes/auth.routes";
import { errorMiddleware } from "../middleware/error.middleware";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(errorMiddleware);

const server = http.createServer(app);

server.listen(0, async () => {
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  console.log("=== COMPREHENSIVE LOGIN ENDPOINT EDGE-CASE & EXCEPTION TEST ===");

  const payloads = [
    { name: "Valid admin123", body: { email: "admin@orion.com", password: "admin123" } },
    { name: "Valid admin@123", body: { email: "admin@orion.com", password: "admin@123" } },
    { name: "Empty object body", body: {} },
    { name: "Null email", body: { email: null, password: "123" } },
    { name: "Null password", body: { email: "admin@orion.com", password: null } },
    { name: "Number email", body: { email: 12345, password: "123" } },
    { name: "Object email", body: { email: { key: "val" }, password: "123" } },
  ];

  for (const p of payloads) {
    try {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body),
      });
      const json = await res.json();
      console.log(`Test '${p.name}': Status ${res.status} | Success: ${json.success} | Error/Message: ${json.error || json.message}`);
    } catch (err: any) {
      console.error(`Test '${p.name}' crashed fetch:`, err.message);
    }
  }

  server.close();
  process.exit(0);
}
);
