import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { logger } from "../logger/logger";
import { env } from "../config/env";

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";
  let details: any = null;

  // Log unexpected errors (not custom AppErrors or Zod validations) with stack traces internally
  if (!(err instanceof AppError) && !(err instanceof ZodError)) {
    logger.error("💥 Unhandled Error", err, {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = "Validation Error";
    details = err.issues.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
  } else if (err && typeof err === "object" && err.code?.startsWith("SQLITE_")) {
    statusCode = 400;
    errorCode = "DATABASE_CONSTRAINT_VIOLATION";
    message = "Database Constraint Violation";
    details = { originalError: err.message };
  } else if (err && (err.name === "MulterError" || err.message?.includes("allowed") || err.message?.includes("upload"))) {
    statusCode = 400;
    errorCode = "UPLOAD_ERROR";
    message = err.message;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum limit is 5 MB";
    }
  } else {
    // General unexpected errors
    if (env.NODE_ENV === "production") {
      message = "An unexpected server error occurred";
    } else {
      message = err instanceof Error ? err.message : String(err);
      details = err instanceof Error ? { stack: err.stack } : null;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    details: env.NODE_ENV === "production" && statusCode === 500 ? null : details,
  });
}
