import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../logger/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();
  const { method, url } = req;

  logger.info(`--> ${method} ${url}`, {
    requestId,
    method,
    url,
    ip: req.ip,
  });

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    logger.info(`<-- ${method} ${url} ${statusCode} - ${duration}ms`, {
      requestId,
      method,
      url,
      statusCode,
      duration,
    });
  });

  next();
}
