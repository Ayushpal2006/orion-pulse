export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public errorCode: string = "INTERNAL_SERVER_ERROR",
    public details: any = null
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details: any = null) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: any = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details: any = null) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details: any = null) {
    super(message, 409, "CONFLICT_ERROR", details);
  }
}
