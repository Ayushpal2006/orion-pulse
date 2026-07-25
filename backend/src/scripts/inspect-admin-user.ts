import { db } from "../db";
import { users, organizations, stores } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function inspectAdmin() {
  console.log("=== INSPECTING DATABASE ROWS ===");
  const [user] = await db.select().from(users).where(eq(users.email, "admin@orion.com")).limit(1);
  console.log("User Row:", user);

  if (user) {
    const isMatch123 = await bcrypt.compare("admin123", user.password_hash || "");
    const isMatchAdmin123 = await bcrypt.compare("admin@123", user.password_hash || "");
    console.log("Bcrypt compare('admin123'):", isMatch123);
    console.log("Bcrypt compare('admin@123'):", isMatchAdmin123);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organization_id || 1)).limit(1);
    console.log("Organization Row:", org);

    const [store] = await db.select().from(stores).where(eq(stores.id, user.store_id || 1)).limit(1);
    console.log("Store Row:", store);
  }
  process.exit(0);
}

inspectAdmin();
