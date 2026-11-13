import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Вспомогательная функция строгой проверки принадлежности назначения текущему судье
const verifyJudgeAssignmentOwnership = async (assignmentId: string, userId: string) => {
  const assignment = await prisma.matchJudge.findUnique({
    where: { id: assignmentId },
    include: {
      judge: true,
      ballot: true,
      match: {
        include: {
          room: true,
          round: {
            include: {
              tournament: true,
            },
          },
          teams: {
            include: {
              team: {
                include: {
                  members: {
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
              participant: true,
            },
          },
          judges: {
            include: {
              judge: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    return { error: 'Назначение на игру не найдено', status: 404 as const };
  }

  if (!assignment.judge.userId || assignment.judge.userId !== userId) {
    return { error: 'Доступ запрещён: это назначение принадлежит другому судье', status: 403 as const };
  }

  return { assignment };
};

// Вычисление порядкового номера игры в рамках раунда
const getMatchGameNumber = async (roundId: string, matchId: string): Promise<number> => {
  const roundMatches = await prisma.match.findMany({
    where: { roundId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const index = roundMatches.findIndex((m) => m.id === matchId);
  return index >= 0 ? index + 1 : 1;
};

// 1. Получение данных для Judge Dashboard
export const getJudgeDashboard = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Все назначения судьи во всех турнирах, где Judge.userId === userId
    const assignments = await prisma.matchJudge.findMany({
      where: {
        judge: {
          userId,
        },
      },
      include: {
        judge: true,
        ballot: true,
        match: {
          include: {
            room: true,
            round: {
              include: {
                tournament: true,
                matches: {
                  select: { id: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { match: { round: { number: 'asc' } } },
        { match: { createdAt: 'asc' } },
      ],
    });

    // Формируем список игр с номером игры и статусом бюллетеня
    const formattedAssignments = assignments.map((item) => {
      const gameIndex = item.match.round.matches.findIndex((m) => m.id === item.match.id);
      const ballotStatus = item.ballot ? item.ballot.status : 'PENDING'; // PENDING | DRAFT | SUBMITTED

      return {
        assignmentId: item.id,
        isChair: item.isChair,
        judgeName: item.judge.name,
        matchId: item.match.id,
        gameNumber: gameIndex >= 0 ? gameIndex + 1 : 1,
        format: item.match.round.format,
        room: item.match.room
          ? { id: item.match.room.id, name: item.match.room.name, building: item.match.room.building }
          : null,
        round: {
          id: item.match.round.id,
          number: item.match.round.number,
          name: item.match.round.name,
          status: item.match.round.status,
        },
        tournament: {
          id: item.match.round.tournament.id,
          name: item.match.round.tournament.name,
          status: item.match.round.tournament.status,
        },
        ballot: item.ballot
          ? {
              id: item.ballot.id,
              status: item.ballot.status,
              updatedAt: item.ballot.updatedAt,
              submittedAt: item.ballot.submittedAt,
            }
          : null,
        ballotStatus,
      };
    });

    const totalAssignments = formattedAssignments.length;
    const submittedCount = formattedAssignments.filter((a) => a.ballotStatus === 'SUBMITTED').length;
    const pendingCount = formattedAssignments.filter((a) => a.ballotStatus !== 'SUBMITTED').length;

    // Активный турнир (приоритет турнирам со статусом ACTIVE, иначе последний назначенный)
    const activeAssignment =
      formattedAssignments.find((a) => a.tournament.status === 'ACTIVE') ||
      formattedAssignments[formattedAssignments.length - 1] ||
      null;

    res.json({
      judge: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      activeTournament: activeAssignment ? activeAssignment.tournament : null,
      stats: {
        totalAssignments,
        submittedCount,
        pendingCount,
      },
      assignments: formattedAssignments,
    });
  } catch (error) {
    console.error('Get judge dashboard error:', error);
    res.status(500).json({ error: 'Ошибка загрузки личного кабинета судьи' });
  }
};

// 2. Получение детальной информации по конкретной игре (Debate / Match)
export const getJudgeAssignmentById = async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;

    const check = await verifyJudgeAssignmentOwnership(assignmentId, userId);
    if ('error' in check) {
      return res.status(check.status).json({ error: check.error });
    }

    const { assignment } = check;
    const gameNumber = await getMatchGameNumber(assignment.match.roundId, assignment.match.id);

    res.json({
      assignmentId: assignment.id,
      isChair: assignment.isChair,
      judge: {
        id: assignment.judge.id,
        name: assignment.judge.name,
      },
      match: {
        id: assignment.match.id,
        gameNumber,
        status: assignment.match.status,
        format: assignment.match.round.format,
        room: assignment.match.room,
        round: {
          id: assignment.match.round.id,
          number: assignment.match.round.number,
          name: assignment.match.round.name,
          format: assignment.match.round.format,
        },
        tournament: {
          id: assignment.match.round.tournament.id,
          name: assignment.match.round.tournament.name,
        },
        teams: assignment.match.teams,
        judges: assignment.match.judges,
      },
      ballot: assignment.ballot
        ? {
            ...assignment.ballot,
            parsedDraftData: assignment.ballot.draftData ? JSON.parse(assignment.ballot.draftData) : null,
          }
        : null,
    });
  } catch (error) {
    console.error('Get judge assignment error:', error);
    res.status(500).json({ error: 'Ошибка загрузки страницы игры' });
  }
};

// 3. Создание (если нет) или получение бюллетеня для назначения (без дубликатов)
export const initOrGetBallot = async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;

    const check = await verifyJudgeAssignmentOwnership(assignmentId, userId);
    if ('error' in check) {
      return res.status(check.status).json({ error: check.error });
    }

    const ballot = await prisma.ballot.upsert({
      where: { matchJudgeId: assignmentId },
      update: {},
      create: {
        matchJudgeId: assignmentId,
        status: 'DRAFT',
        draftData: JSON.stringify({}),
        notes: '',
      },
    });

    res.json({
      ...ballot,
      parsedDraftData: ballot.draftData ? JSON.parse(ballot.draftData) : null,
    });
  } catch (error) {
    console.error('Init/Get ballot error:', error);
    res.status(500).json({ error: 'Ошибка инициализации бюллетеня' });
  }
};

// 4. Сохранение черновика бюллетеня (DRAFT)
export const saveBallotDraft = async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const { draftData, notes } = req.body;

    const check = await verifyJudgeAssignmentOwnership(assignmentId, userId);
    if ('error' in check) {
      return res.status(check.status).json({ error: check.error });
    }

    if (check.assignment.ballot?.status === 'SUBMITTED') {
      return res.status(409).json({ error: 'Бюллетень уже отправлен и недоступен для редактирования' });
    }

    const serializedDraft = draftData !== undefined ? JSON.stringify(draftData) : undefined;

    const ballot = await prisma.ballot.upsert({
      where: { matchJudgeId: assignmentId },
      update: {
        status: 'DRAFT',
        ...(serializedDraft !== undefined ? { draftData: serializedDraft } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      create: {
        matchJudgeId: assignmentId,
        status: 'DRAFT',
        draftData: serializedDraft || JSON.stringify({}),
        notes: notes || '',
      },
    });

    res.json({
      ...ballot,
      parsedDraftData: ballot.draftData ? JSON.parse(ballot.draftData) : null,
    });
  } catch (error) {
    console.error('Save ballot draft error:', error);
    res.status(500).json({ error: 'Ошибка сохранения черновика бюллетеня' });
  }
};

// 5. Финальная отправка бюллетеня (SUBMITTED)
export const submitBallot = async (req: any, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const { draftData, notes } = req.body;

    const check = await verifyJudgeAssignmentOwnership(assignmentId, userId);
    if ('error' in check) {
      return res.status(check.status).json({ error: check.error });
    }

    if (check.assignment.ballot?.status === 'SUBMITTED') {
      return res.status(409).json({ error: 'Бюллетень уже был отправлен ранее' });
    }

    const serializedDraft =
      draftData !== undefined
        ? JSON.stringify(draftData)
        : check.assignment.ballot?.draftData || JSON.stringify({});

    const ballot = await prisma.ballot.upsert({
      where: { matchJudgeId: assignmentId },
      update: {
        status: 'SUBMITTED',
        draftData: serializedDraft,
        ...(notes !== undefined ? { notes } : {}),
        submittedAt: new Date(),
      },
      create: {
        matchJudgeId: assignmentId,
        status: 'SUBMITTED',
        draftData: serializedDraft,
        notes: notes || '',
        submittedAt: new Date(),
      },
    });

    res.json({
      ...ballot,
      parsedDraftData: ballot.draftData ? JSON.parse(ballot.draftData) : null,
    });
  } catch (error) {
    console.error('Submit ballot error:', error);
    res.status(500).json({ error: 'Ошибка отправки бюллетеня' });
  }
};
