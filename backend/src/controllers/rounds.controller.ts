import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// Получить все раунды турнира
export const getRounds = async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: 'asc' },
    });
    res.json(rounds);
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка получения раундов' });
  }
};


// Создать раунд (с автонумерацией)
export const createRound = async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { name, type, format, duration, dateTime, status, motion } = req.body;

    // Автоматический расчет следующего номера раунда
    const lastRound = await prisma.round.findFirst({
      where: { tournamentId },
      orderBy: { number: 'desc' },
    });
    const nextNumber = lastRound ? lastRound.number + 1 : 1;

    // Получаем турнир для определения формата по умолчанию, если не передан
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });

    const round = await prisma.round.create({
      data: {
        tournamentId,
        number: nextNumber,
        name: name || `Раунд ${nextNumber}`,
        type: type || 'PRELIMINARY',
        format: format || tournament?.format || 'BP',
        duration: Number(duration) || 60,
        dateTime: dateTime ? new Date(dateTime) : null,
        status: status || 'PLANNED',
        motion: motion || null,
      },
    });

    res.status(201).json(round);
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка создания раунда' });
  }
};

// Обновить раунд
export const updateRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, format, duration, dateTime, status, number, motion } = req.body;

    const round = await prisma.round.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(format !== undefined && { format }),
        ...(duration !== undefined && { duration: Number(duration) }),
        ...(dateTime !== undefined && { dateTime: dateTime ? new Date(dateTime) : null }),
        ...(status !== undefined && { status }),
        ...(number !== undefined && { number: Number(number) }),
        ...(motion !== undefined && { motion }),
      },
    });

    res.json(round);
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка обновления раунда' });
  }
};

// Дублировать раунд
export const duplicateRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const targetRound = await prisma.round.findUnique({ where: { id } });

    if (!targetRound) {
      return res.status(404).json({ error: 'Раунд не найден' });
    }

    // Вычисляем следующий номер
    const lastRound = await prisma.round.findFirst({
      where: { tournamentId: targetRound.tournamentId },
      orderBy: { number: 'desc' },
    });
    const nextNumber = lastRound ? lastRound.number + 1 : 1;

    const duplicated = await prisma.round.create({
      data: {
        tournamentId: targetRound.tournamentId,
        number: nextNumber,
        name: `${targetRound.name} (Копия)`,
        type: targetRound.type,
        format: targetRound.format,
        duration: targetRound.duration,
        dateTime: targetRound.dateTime,
        status: 'PLANNED',
        motion: targetRound.motion, // Копируем резолюцию тоже
      },
    });

    res.status(201).json(duplicated);
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка дублирования раунда' });
  }
};

// Удалить раунд
export const deleteRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.round.delete({ where: { id } });
    res.json({ message: 'Раунд успешно удален' });
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка удаления раунда' });
  }
};
