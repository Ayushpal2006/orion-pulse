import { Router } from "express";
import { expenseController } from "./expenses.controller";
import { authorize } from "../../middleware/auth.middleware";

const router = Router();

router.post("/categories", authorize("admin", "manager"), expenseController.createCategory);
router.get("/categories", expenseController.getCategories);
router.post("/", authorize("admin", "manager"), expenseController.createExpense);
router.put("/:id", authorize("admin", "manager"), expenseController.updateExpense);
router.get("/", expenseController.getAll);
router.get("/summary", expenseController.getSummary);
router.delete("/:id", authorize("admin", "manager"), expenseController.delete);

export default router;
export const expenseRoutes = router;
