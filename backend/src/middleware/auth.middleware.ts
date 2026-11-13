import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'rhetora_super_secret';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  // Впомогательная функция получения/создания дефолтного пользователя
  const setDevUser = async () => {
    let devUser = await prisma.user.findFirst();
    if (!devUser) {
      devUser = await prisma.user.create({
        data: {
          email: 'admin@rhetora.kz',
          password: 'hashed_password',
          name: 'Влад (Организатор)',
          role: 'ORGANIZER',
        },
      });
    }
    req.user = { id: devUser.id, role: devUser.role };
  };

  if (!token || token === 'null' || token === 'undefined') {
    await setDevUser();
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    // Если токен оказался недействительным или просрочен — переключаемся на локального dev-пользователя
    await setDevUser();
    next();
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'У вас нет прав для этого действия' });
    }
    next();
  };
};

export const requireJudge = (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  if (req.user.role !== 'JUDGE') {
    return res.status(403).json({ error: 'Доступ разрешён только пользователям с ролью JUDGE' });
  }
  next();
};
