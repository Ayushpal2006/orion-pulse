import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Whitelist Railway service health checks
    return req.path === "/health" || req.path === "/";
  },
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
    errorCode: "TOO_MANY_REQUESTS",
  },
});
