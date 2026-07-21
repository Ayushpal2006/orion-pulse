import { Router } from "express";
import { ExpenseController } from "../controllers/expense.controller";
import { authorize } from "../middleware/auth.middleware";

const router = Router();
const controller = new ExpenseController();

router.post("/categories", authorize("admin", "manager"), controller.createCategory);
router.get("/categories", controller.getCategories);
router.post("/", authorize("admin", "manager"), controller.createExpense);
router.put("/:id", authorize("admin", "manager"), controller.updateExpense);
router.get("/", controller.getAll);
router.get("/summary", controller.getSummary);
router.delete("/:id", authorize("admin", "manager"), controller.delete);

export default router;
