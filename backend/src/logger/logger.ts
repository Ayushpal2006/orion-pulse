export class CentralizedLogger {
  private get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  private formatMessage(level: string, message: string, meta?: Record<string, any>): string | object {
    const timestamp = new Date().toISOString();
    if (this.isProduction) {
      return {
        timestamp,
        level,
        message,
        ...meta,
      };
    } else {
      const metaString = meta && Object.keys(meta).length > 0 ? ` | meta: ${JSON.stringify(meta)}` : "";
      return `[${timestamp}] [${level}] ${message}${metaString}`;
    }
  }

  info(message: string, meta?: Record<string, any>): void {
    const formatted = this.formatMessage("INFO", message, meta);
    if (typeof formatted === "object") {
      console.log(JSON.stringify(formatted));
    } else {
      console.info(`\x1b[32m${formatted}\x1b[0m`); // Green
    }
  }

  warn(message: string, meta?: Record<string, any>): void {
    const formatted = this.formatMessage("WARN", message, meta);
    if (typeof formatted === "object") {
      console.warn(JSON.stringify(formatted));
    } else {
      console.warn(`\x1b[33m${formatted}\x1b[0m`); // Yellow
    }
  }

  error(message: string, error?: any, meta?: Record<string, any>): void {
    if (error) {
      console.error("=========================================");
      console.error("Original PostgreSQL error message:", error.message || String(error));
      console.error("SQLSTATE error code:", error.code || error.sqlState || "N/A");
      console.error("Complete stack trace:", error.stack || "N/A");
      console.error("Failed SQL:", error.query || error.sql || meta?.path || "N/A");
      console.error("Parameters:", error.parameters || error.params || meta?.ip || "N/A");
      console.error("=========================================");
    }

    const errorMeta: Record<string, any> = {};
    if (error !== undefined) {
      if (error instanceof Error) {
        errorMeta.errorMessage = error.message;
        errorMeta.errorStack = error.stack;
        if ((error as any).code) errorMeta.code = (error as any).code;
        if ((error as any).query) errorMeta.query = (error as any).query;
        if ((error as any).parameters) errorMeta.parameters = (error as any).parameters;
      } else {
        errorMeta.errorDetail = String(error);
      }
    }

    const combinedMeta = { ...errorMeta, ...meta };
    const formatted = this.formatMessage("ERROR", message, combinedMeta);

    if (typeof formatted === "object") {
      console.error(JSON.stringify(formatted));
    } else {
      const stackSuffix = error instanceof Error ? `\nStack: ${error.stack}` : "";
      console.error(`\x1b[31m${formatted}${stackSuffix}\x1b[0m`); // Red
    }
  }

  debug(message: string, meta?: Record<string, any>): void {
    if (!this.isProduction) {
      const formatted = this.formatMessage("DEBUG", message, meta);
      console.debug(`\x1b[36m${formatted}\x1b[0m`); // Cyan
    }
  }
}

export const logger = new CentralizedLogger();
