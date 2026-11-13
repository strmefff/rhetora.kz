import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  console.error(`❌ [ERROR ${statusCode}] ${req.method} ${req.url}:`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      method: req.method,
      path: req.url,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      details: err.details || null,
    },
  });
};
