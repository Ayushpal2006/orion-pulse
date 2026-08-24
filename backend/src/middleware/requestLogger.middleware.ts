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
    const rawContentLength = res.getHeader("content-length");
    const contentLength = typeof rawContentLength === "number"
      ? rawContentLength
      : typeof rawContentLength === "string"
      ? parseInt(rawContentLength, 10)
      : undefined;

    const sizeFormatted = contentLength !== undefined && !isNaN(contentLength)
      ? contentLength >= 1024 * 1024
        ? `${(contentLength / (1024 * 1024)).toFixed(2)} MB`
        : contentLength >= 1024
        ? `${(contentLength / 1024).toFixed(1)} KB`
        : `${contentLength} B`
      : undefined;

    const sizeStr = sizeFormatted ? ` [${sizeFormatted}]` : "";

    logger.info(`<-- ${method} ${url} ${statusCode} - ${duration}ms${sizeStr}`, {
      requestId,
      method,
      url,
      statusCode,
      duration,
      contentLength,
    });
  });

  next();
}
