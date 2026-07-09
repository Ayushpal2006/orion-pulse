import { Router, Request, Response, NextFunction } from "express";
import { PrinterService } from "../services/printer.service";

const router = Router();
const printerService = new PrinterService();

router.post("/test", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const config = printerService.getPrinterConfig();
    const result = await printerService.printTestPage(config);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
