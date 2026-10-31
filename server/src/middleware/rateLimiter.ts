import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication endpoint to prevent brute-force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

// General API rate limiter to protect against denial of service
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});

// Sync rate limiter to prevent flooding the database with sync batches
export const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 sync calls per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many synchronization requests. Please try again shortly.',
  },
});
