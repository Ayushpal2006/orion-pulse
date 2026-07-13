import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { suppliers, supplier_payments, supplier_ledger } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { ValidationError, NotFoundError } from "../utils/errors";

export class SupplierController {
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const rows = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.is_active, 1), eq(suppliers.store_id, storeId)))
        .orderBy(desc(suppliers.id));

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(id) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const rows = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.store_id, storeId)))
        .limit(1);

      if (!rows[0]) {
        throw new NotFoundError(`Supplier with ID ${id} not found`);
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const storeId = getStoreId();
      if (storeId === undefined) {
        res.status(400).json({ success: false, error: "Store context is required" });
        return;
      }

      const body = req.body;
      if (!body.company_name || !body.supplier_code) {
        throw new ValidationError("Company name and supplier code are required");
      }

      // Check duplicate code
      const existing = await db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.supplier_code, body.supplier_code), eq(suppliers.store_id, storeId)))
        .limit(1);

      if (existing[0]) {
        throw new ValidationError(`Supplier with code "${body.supplier_code}" already exists`);
      }

      const openingBal = body.opening_balance ?? 0;
      const [created] = await db
        .insert(suppliers)
        .values({
          store_id: storeId,
          supplier_code: body.supplier_code,
          company_name: body.company_name,
          contact_person: body.contact_person ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null,
          gst_number: body.gst_number ?? null,
          pan_number: body.pan_number ?? null,
          address: body.address ?? null,
          city: body.city ?? null,
          state: body.state ?? null,
          country: body.country ?? null,
          postal_code: body.postal_code ?? null,
          opening_balance: openingBal,
          current_balance: openingBal,
          payment_terms: body.payment_terms ?? null,
          credit_limit: body.credit_limit ?? 0,
          is_active: 1,
          notes: body.notes ?? null,
        })
        .returning();

      // Seed supplier ledger opening entry if opening balance > 0
      if (openingBal > 0) {
        await db.insert(supplier_ledger).values({
          store_id: storeId,
          supplier_id: created.id,
          transaction_type: "ADJUSTMENT",
          amount: openingBal,
          balance: openingBal,
          reference: "Opening Balance",
        });
      }

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(id) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const body = req.body;
      const updateData: any = {};
      const fields = [
        "company_name",
        "contact_person",
        "phone",
        "email",
        "gst_number",
        "pan_number",
        "address",
        "city",
        "state",
        "country",
        "postal_code",
        "payment_terms",
        "credit_limit",
        "notes",
      ];
      for (const field of fields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      updateData.updated_at = new Date();

      const [updated] = await db
        .update(suppliers)
        .set(updateData)
        .where(and(eq(suppliers.id, id), eq(suppliers.store_id, storeId)))
        .returning();

      if (!updated) {
        throw new NotFoundError(`Supplier with ID ${id} not found`);
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(id) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const [deleted] = await db
        .update(suppliers)
        .set({ is_active: 0, updated_at: new Date() })
        .where(and(eq(suppliers.id, id), eq(suppliers.store_id, storeId)))
        .returning();

      if (!deleted) {
        throw new NotFoundError(`Supplier with ID ${id} not found`);
      }

      res.status(200).json({ success: true, message: "Supplier deleted successfully" });
    } catch (error) {
      next(error);
    }
  };

  recordPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(supplierId) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const { amount, paymentMethod, referenceNumber, notes } = req.body;
      if (!amount || amount <= 0 || !paymentMethod) {
        throw new ValidationError("Amount (>0) and payment method are required");
      }

      const result = await db.transaction(async (tx) => {
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.id, supplierId), eq(suppliers.store_id, storeId)))
          .limit(1);

        if (!supplier) {
          throw new NotFoundError(`Supplier with ID ${supplierId} not found`);
        }

        const newBalance = supplier.current_balance - amount;

        // 1. Update supplier balance
        await tx
          .update(suppliers)
          .set({ current_balance: newBalance, updated_at: new Date() })
          .where(eq(suppliers.id, supplierId));

        // 2. Insert payment record
        const [payment] = await tx
          .insert(supplier_payments)
          .values({
            store_id: storeId,
            supplier_id: supplierId,
            amount,
            payment_method: paymentMethod,
            reference_number: referenceNumber ?? null,
            notes: notes ?? null,
          })
          .returning();

        // 3. Insert ledger entry
        await tx.insert(supplier_ledger).values({
          store_id: storeId,
          supplier_id: supplierId,
          transaction_type: "PAYMENT",
          amount: -amount, // Debited from ledger balance (decreases outstanding)
          balance: newBalance,
          reference: referenceNumber ?? `Payment Ref ${payment.id}`,
        });

        return payment;
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supplierId = parseInt(req.params.id as string, 10);
      const storeId = getStoreId();
      if (isNaN(supplierId) || storeId === undefined) {
        res.status(400).json({ success: false, error: "Invalid parameters" });
        return;
      }

      const rows = await db
        .select()
        .from(supplier_ledger)
        .where(and(eq(supplier_ledger.supplier_id, supplierId), eq(supplier_ledger.store_id, storeId)))
        .orderBy(desc(supplier_ledger.id));

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  };
}
