import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// Получить список всех аккаунтов (Только для SUPERADMIN)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
};

// Изменить роль пользователя
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления роли' });
  }
};

// Удалить аккаунт
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
};
