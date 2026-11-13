import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// Генератор уникального кода доступа судьи (формат RH-XXXX без похожих символов)
const generateUniqueJudgeCode = async (): Promise<string> => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  while (true) {
    let code = 'RH-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.judge.findUnique({ where: { accessCode: code } });
    if (!existing) return code;
  }
};

// Хелпер для CSV
const parseCSV = (csvText: string) => {
  const lines = csvText.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ''));
    const entry: Record<string, string> = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] || '';
    });
    return entry;
  });
};

const generateCSV = (headers: string[], rows: (string | number)[][]) => {
  const headerRow = headers.join(',');
  const contentRows = rows.map(r => r.map(val => `"${val}"`).join(','));
  return [headerRow, ...contentRows].join('\n');
};

// ================= PARTICIPANTS =================
export const getParticipants = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const participants = await prisma.participant.findMany({
      where: { tournamentId },
      include: { team: true },
      orderBy: { lastName: 'asc' },
    });
    res.json(participants);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки участников' });
  }
};

export const createParticipant = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  const { firstName, lastName, email, organization, city, teamId } = req.body;

  try {
    const existing = await prisma.participant.findUnique({
      where: { tournamentId_email: { tournamentId, email } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Участник с таким Email уже есть на этом турнире' });
    }

    const participant = await prisma.participant.create({
      data: { tournamentId, firstName, lastName, email, organization, city, teamId: teamId || null }
    });
    res.status(201).json(participant);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка создания участника' });
  }
};

export const updateParticipant = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const participant = await prisma.participant.update({
      where: { id },
      data: req.body,
    });
    res.json(participant);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка обновления участника' });
  }
};

export const deleteParticipant = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.participant.delete({ where: { id } });
    res.json({ message: 'Участник удален' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
};

export const importParticipantsCSV = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  const { csvData } = req.body;

  try {
    const parsed = parseCSV(csvData);
    let created = 0;
    let skipped = 0;

    for (const item of parsed) {
      if (!item.email || !item.firstName || !item.lastName) continue;
      try {
        await prisma.participant.create({
          data: {
            tournamentId,
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            organization: item.organization || '',
            city: item.city || ''
          }
        });
        created++;
      } catch (err) {
        skipped++;
      }
    }
    res.json({ message: `Импортировано: ${created}, пропущено дубликатов: ${skipped}` });
  } catch (error) {
    res.status(400).json({ error: 'Ошибка файла CSV' });
  }
};

export const exportParticipantsCSV = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const participants = await prisma.participant.findMany({ where: { tournamentId } });
    const headers = ['firstName', 'lastName', 'email', 'organization', 'city'];
    const rows = participants.map(p => [p.firstName, p.lastName, p.email, p.organization || '', p.city || '']);
    const csvContent = generateCSV(headers, rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=participants.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка экспорта CSV' });
  }
};

// ================= TEAMS =================
export const getTeams = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const teams = await prisma.team.findMany({
      where: { tournamentId },
      include: { members: true },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки команд' });
  }
};

export const createTeam = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  const { name, organization, city, coach, seed, memberIds } = req.body;

  try {
    const existing = await prisma.team.findUnique({
      where: { tournamentId_name: { tournamentId, name } }
    });
    if (existing) {
      return res.status(400).json({ error: 'Команда с таким названием уже существует' });
    }

    const team = await prisma.team.create({
      data: {
        tournamentId,
        name,
        organization,
        city,
        coach,
        seed: Number(seed) || 0,
        members: memberIds && memberIds.length > 0 ? {
          connect: memberIds.map((id: string) => ({ id }))
        } : undefined
      },
      include: { members: true }
    });
    res.status(201).json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка при создании команды' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.team.delete({ where: { id } });
    res.json({ message: 'Команда удалена' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при удалении команды' });
  }
};

// ================= JUDGES =================
export const getJudges = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const judges = await prisma.judge.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { rating: 'desc' },
    });

    // Автоматически генерируем accessCode для существующих судей, у которых его ещё нет
    for (const judge of judges) {
      if (!judge.accessCode) {
        const newCode = await generateUniqueJudgeCode();
        await prisma.judge.update({
          where: { id: judge.id },
          data: { accessCode: newCode },
        });
        judge.accessCode = newCode;
      }
    }

    res.json(judges);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения судей' });
  }
};

export const createJudge = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  const { name, email, userId, organization, experience, category, rating } = req.body;

  try {
    // Проверяем, не добавлен ли уже этот аккаунт в коллегию данного турнира
    if (userId) {
      const existingJudge = await prisma.judge.findFirst({
        where: { tournamentId, userId },
      });
      if (existingJudge) {
        return res.status(400).json({ error: 'Этот пользователь уже добавлен в судейскую коллегию турнира' });
      }
    }

    const accessCode = await generateUniqueJudgeCode();

    const judge = await prisma.judge.create({
      data: {
        tournamentId,
        userId: userId || null,
        name,
        email: email || null,
        accessCode,
        organization,
        experience,
        category: category || 'JUDGE',
        rating: Number(rating) || 5.0,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    res.status(201).json(judge);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка создания судьи' });
  }
};

export const updateJudge = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { userId, category, name, email } = req.body;

  try {
    const current = await prisma.judge.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'Судья не найден' });
    }

    if (userId) {
      const duplicate = await prisma.judge.findFirst({
        where: {
          tournamentId: current.tournamentId,
          userId,
          id: { not: id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: 'Этот аккаунт уже привязан к другому судье в данном турнире' });
      }
    }

    const updated = await prisma.judge.update({
      where: { id },
      data: {
        ...(userId !== undefined ? { userId: userId || null } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка обновления судьи' });
  }
};

export const deleteJudge = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.judge.delete({ where: { id } });
    res.json({ message: 'Судья удален' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления судьи' });
  }
};

// ================= ROOMS =================
export const getRooms = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  try {
    const rooms = await prisma.room.findMany({
      where: { tournamentId },
      orderBy: { name: 'asc' },
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения комнат' });
  }
};

export const createRoom = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;
  const { name, building, floor, capacity } = req.body;

  try {
    const room = await prisma.room.create({
      data: {
        tournamentId,
        name,
        building,
        floor: floor ? Number(floor) : null,
        capacity: capacity ? Number(capacity) : 20,
      }
    });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания комнаты' });
  }
};

export const deleteRoom = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.room.delete({ where: { id } });
    res.json({ message: 'Комната удалена' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления комнаты' });
  }
};
