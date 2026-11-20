import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'rhetora_super_secret';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким Email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const count = await prisma.user.count();
    const assignedRole = count === 0 ? 'SUPERADMIN' : (role || 'ORGANIZER');

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        role: assignedRole,
      },
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка при регистрации' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Введите Email и пароль' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim() } });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Неверный логин или пароль' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка при входе' });
  }
};

export const judgeMagicLogin = async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.body.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Укажите код доступа судьи' });
    }

    const judge = await prisma.judge.findUnique({
      where: { accessCode: rawCode },
    });

    if (!judge) {
      return res.status(404).json({ error: 'Неверный код или ссылка доступа' });
    }

    let user = judge.userId
      ? await prisma.user.findUnique({ where: { id: judge.userId } })
      : judge.email
      ? await prisma.user.findUnique({ where: { email: judge.email.trim() } })
      : null;

    if (!user) {
      const cleanPrefix = rawCode.replace(/[^A-Z0-9]/g, '').toLowerCase();
      const tempEmail =
        judge.email?.trim() || `judge_${cleanPrefix}_${Date.now()}@temp.rhetora.kz`;
      const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);

      user = await prisma.user.create({
        data: {
          name: judge.name,
          email: tempEmail,
          password: randomPassword,
          role: 'JUDGE',
        },
      });
    }

    if (!judge.userId || !judge.email) {
      await prisma.judge.update({
        where: { id: judge.id },
        data: {
          userId: user.id,
          email: judge.email || user.email,
        },
      });
    }

    const effectiveRole = user.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'JUDGE';
    const token = jwt.sign({ id: user.id, role: effectiveRole }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: effectiveRole,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('Judge magic login error:', error);
    res.status(500).json({ error: 'Ошибка входа по ссылке судьи' });
  }
};

// Получение профиля и статистики активности
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const [user, judgedGamesCount, submittedBallotsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          telegram: true,
          organization: true,
          city: true,
          role: true,
          createdAt: true,
          _count: {
            select: { tournaments: true },
          },
        },
      }),
      prisma.matchJudge.count({
        where: { judge: { userId } },
      }),
      prisma.ballot.count({
        where: {
          status: 'SUBMITTED',
          matchJudge: { judge: { userId } },
        },
      }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const { _count, ...userData } = user;

    res.json({
      ...userData,
      stats: {
        tournamentsCount: _count.tournaments,
        judgedGamesCount,
        submittedBallotsCount,
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
};

// Обновление личных и дебатных данных
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, email, avatar, telegram, organization, city } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Имя не может быть пустым' });
    }

    if (email !== undefined && !email.trim()) {
      return res.status(400).json({ error: 'Email не может быть пустым' });
    }

    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.trim(), NOT: { id: userId } },
      });

      if (existing) {
        return res.status(400).json({ error: 'Этот Email уже используется другим аккаунтом' });
      }
    }

    const cleanTelegram =
      telegram !== undefined
        ? telegram
          ? String(telegram).trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@+/, '')
          : null
        : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email.trim() }),
        ...(avatar !== undefined && { avatar }),
        ...(cleanTelegram !== undefined && { telegram: cleanTelegram }),
        ...(organization !== undefined && { organization: organization ? String(organization).trim() : null }),
        ...(city !== undefined && { city: city ? String(city).trim() : null }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        telegram: true,
        organization: true,
        city: true,
        role: true,
      },
    });

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

// Смена пароля
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Заполните все поля для смены пароля' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен содержать не менее 6 символов' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Неверный текущий пароль' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Пароль успешно изменён' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
};
