import express from "express";
import http from "http";
import authRoutes from "../routes/auth.routes";

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

app.use((err: any, req: any, res: any, next: any) => {
  console.log("=== EXCEPTION CAPTURED IN ERROR MIDDLEWARE ===");
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  console.error("Full Stack Trace:\n", err.stack);
  res.status(500).json({ success: false, error: err.message, stack: err.stack });
});

const server = http.createServer(app);

server.listen(0, async () => {
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  console.log("Sending login request with email: admin@orion.com, password: admin@123");
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@orion.com", password: "admin@123" }),
  });

  const json = await res.json();
  console.log("\nResponse Status Code:", res.status);
  console.log("Response Body:\n", JSON.stringify(json, null, 2));

  server.close();
  process.exit(0);
});
