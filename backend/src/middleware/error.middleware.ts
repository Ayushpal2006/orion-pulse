import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ValidationError, NotFoundError } from "../services/product.service";

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log unexpected errors
  if (!(err instanceof ValidationError) && !(err instanceof NotFoundError) && !(err instanceof ZodError)) {
    console.error("💥 Unhandled Error:", err);
  }

  // Handle Zod Schema validation errors
  if (err instanceof ZodError) {
    const errorDetails = err.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    
    res.status(400).json({
      success: false,
      message: "Validation Error",
      error: errorDetails,
    });
    return;
  }

  // Handle Domain/Business validation errors
  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      message: "Business Validation Error",
      error: err.message,
    });
    return;
  }

  // Handle Resource Not Found errors
  if (err instanceof NotFoundError) {
    res.status(404).json({
      success: false,
      message: "Not Found",
      error: err.message,
    });
    return;
  }

  // Handle Database constraint violations (SQLite errors)
  if (err && typeof err === "object" && err.code?.startsWith("SQLITE_")) {
    res.status(400).json({
      success: false,
      message: "Database Constraint Violation",
      error: err.message,
    });
    return;
  }

  // Fallback for generic server errors
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err instanceof Error ? err.message : "An unexpected error occurred",
  });
}
