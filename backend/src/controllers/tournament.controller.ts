import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export const createTournament = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, city, location, startDate, endDate, format, roundsCount } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название турнира обязательно' });
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description || '',
        city: city || 'Астана',
        location: location || '',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(),
        format: format || 'BP', // Поддерживает 'BP' (БПФ), 'WSDC' (ВШФ), 'LD' (ЛД)
        roundsCount: Number(roundsCount) || 5,
        status: 'PREPARATION',
        organizerId: req.user?.id || 'demo-organizer-id',
      },
    });

    return res.status(201).json(tournament);
  } catch (error) {
    console.error('Ошибка создания турнира:', error);
    return res.status(500).json({ error: 'Ошибка сервера при создании турнира' });
  }
};

export const getTournaments = async (req: AuthRequest, res: Response) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(tournaments);
  } catch (error) {
    console.error('Ошибка получения турниров:', error);
    return res.status(500).json({ error: 'Ошибка сервера при получении турниров' });
  }
};

export const getTournamentById = async (req: AuthRequest, res: Response) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    });
    if (!tournament) return res.status(404).json({ error: 'Турнир не найден' });
    return res.json(tournament);
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка при получении турнира' });
  }
};

export const updateTournament = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, city, location, startDate, endDate, format, roundsCount, status } = req.body;

    // Безопасное обновление с фильтрацией полей
    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(city !== undefined && { city }),
        ...(location !== undefined && { location }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(format !== undefined && { format }),
        ...(roundsCount !== undefined && { roundsCount: Number(roundsCount) }),
        ...(status !== undefined && { status }),
      },
    });

    return res.json(tournament);
  } catch (error) {
    console.error('Ошибка обновления турнира:', error);
    return res.status(500).json({ error: 'Ошибка обновления турнира' });
  }
};

export const deleteTournament = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tournament.delete({ where: { id } });
    return res.json({ message: 'Турнир удален' });
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка удаления' });
  }
};

// ==================== РАУНДЫ ТУРНИРА ====================

// Получить все раунды конкретного турнира
export const getRounds = async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: 'asc' },
    });
    return res.json(rounds);
  } catch (error) {
    console.error('Ошибка получения раундов:', error);
    return res.status(500).json({ error: 'Ошибка сервера при получении раундов' });
  }
};

// Создать раунд (с автонумерацией)
export const createRound = async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { name, type, format, duration, dateTime, status } = req.body;

    // Автоматический расчет следующего порядкового номера раунда
    const lastRound = await prisma.round.findFirst({
      where: { tournamentId },
      orderBy: { number: 'desc' },
    });
    const nextNumber = lastRound ? lastRound.number + 1 : 1;

    // Получаем турнир для подстановки формата по умолчанию, если он не указан явно
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
      },
    });

    return res.status(201).json(round);
  } catch (error) {
    console.error('Ошибка создания раунда:', error);
    return res.status(500).json({ error: 'Ошибка сервера при создании раунда' });
  }
};

// Обновить раунд
export const updateRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, format, duration, dateTime, status, number } = req.body;

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
      },
    });

    return res.json(round);
  } catch (error) {
    console.error('Ошибка обновления раунда:', error);
    return res.status(500).json({ error: 'Ошибка сервера при обновлении раунда' });
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
      },
    });

    return res.status(201).json(duplicated);
  } catch (error) {
    console.error('Ошибка дублирования раунда:', error);
    return res.status(500).json({ error: 'Ошибка сервера при дублировании раунда' });
  }
};

// Удалить раунд
export const deleteRound = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.round.delete({ where: { id } });
    return res.json({ message: 'Раунд успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления раунда:', error);
    return res.status(500).json({ error: 'Ошибка сервера при удалении раунда' });
  }
};
