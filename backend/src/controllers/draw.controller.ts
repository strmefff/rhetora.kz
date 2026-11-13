import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Утилита перемешивания Фишера — Йетса
const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 1. Получение жеребьёвки раунда
export const getDraw = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;

    const matches = await prisma.match.findMany({
      where: { roundId },
      include: {
        room: true,
        teams: {
          include: {
            team: true,
            participant: true,
          },
        },
        judges: {
          include: {
            judge: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(matches);
  } catch (error) {
    console.error('Get draw error:', error);
    res.status(500).json({ error: 'Ошибка загрузки жеребьёвки' });
  }
};

// 2. Генерация случайной жеребьёвки
export const generateDraw = async (req: Request, res: Response) => {
  try {
    const { tournamentId, roundId } = req.params;

    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Раунд не найден' });
    }

    await prisma.match.deleteMany({ where: { roundId } });

    const [teams, participants, judges, rooms] = await Promise.all([
      prisma.team.findMany({ where: { tournamentId } }),
      prisma.participant.findMany({ where: { tournamentId } }),
      prisma.judge.findMany({ where: { tournamentId } }),
      prisma.room.findMany({ where: { tournamentId } }),
    ]);

    const shuffledJudges = shuffle(judges);
    const shuffledRooms = shuffle(rooms);

    if (round.format === 'BP') {
      const shuffledTeams = shuffle(teams);
      const positions = ['OG', 'OO', 'CG', 'CO'];
      const matchCount = Math.floor(shuffledTeams.length / 4);

      for (let i = 0; i < matchCount; i++) {
        const group = shuffledTeams.slice(i * 4, i * 4 + 4);
        await prisma.match.create({
          data: {
            roundId,
            roomId: shuffledRooms[i]?.id || null,
            teams: {
              create: group.map((t, idx) => ({
                teamId: t.id,
                position: positions[idx],
              })),
            },
            ...(shuffledJudges[i]
              ? { judges: { create: [{ judgeId: shuffledJudges[i].id, isChair: true }] } }
              : {}),
          },
        });
      }
    } else if (round.format === 'LD') {
      const shuffledParticipants = shuffle(participants);
      const matchCount = Math.floor(shuffledParticipants.length / 2);

      for (let i = 0; i < matchCount; i++) {
        const p1 = shuffledParticipants[i * 2];
        const p2 = shuffledParticipants[i * 2 + 1];
        await prisma.match.create({
          data: {
            roundId,
            roomId: shuffledRooms[i]?.id || null,
            teams: {
              create: [
                { participantId: p1.id, position: 'AFF' },
                { participantId: p2.id, position: 'NEG' },
              ],
            },
            ...(shuffledJudges[i]
              ? { judges: { create: [{ judgeId: shuffledJudges[i].id, isChair: true }] } }
              : {}),
          },
        });
      }
    } else {
      const shuffledTeams = shuffle(teams);
      const matchCount = Math.floor(shuffledTeams.length / 2);

      for (let i = 0; i < matchCount; i++) {
        const gov = shuffledTeams[i * 2];
        const opp = shuffledTeams[i * 2 + 1];
        await prisma.match.create({
          data: {
            roundId,
            roomId: shuffledRooms[i]?.id || null,
            teams: {
              create: [
                { teamId: gov.id, position: 'GOV' },
                { teamId: opp.id, position: 'OPP' },
              ],
            },
            ...(shuffledJudges[i]
              ? { judges: { create: [{ judgeId: shuffledJudges[i].id, isChair: true }] } }
              : {}),
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Generate draw error:', error);
    res.status(500).json({ error: 'Ошибка генерации жеребьёвки' });
  }
};

// 2.1. Создание или обновление жеребьёвки этапа плей-офф из турнирной сетки
export const createPlayoffDraw = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { stageType, stageName, pairs } = req.body as {
      stageType: string;
      stageName: string;
      pairs: Array<{ govTeamId: string; oppTeamId: string }>;
    };

    if (!stageType || !Array.isArray(pairs) || pairs.length === 0) {
      return res.status(400).json({ error: 'Нет сформированных пар для отправки в жеребьёвку' });
    }

    // Проверяем, что команды реальные (не демо-шаблоны)
    const teamIds = Array.from(
      new Set(pairs.flatMap((p) => [p.govTeamId, p.oppTeamId]).filter(Boolean))
    );
    const existingTeams = await prisma.team.findMany({
      where: { tournamentId, id: { in: teamIds } },
      select: { id: true },
    });
    const validTeamIds = new Set(existingTeams.map((t) => t.id));

    const validPairs = pairs.filter(
      (p) => validTeamIds.has(p.govTeamId) && validTeamIds.has(p.oppTeamId)
    );

    if (validPairs.length === 0) {
      return res.status(400).json({
        error: 'В сетке выбраны демо-команды. Нажмите «Перепосеять из таблицы», чтобы использовать команды турнира.',
      });
    }

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      return res.status(404).json({ error: 'Турнир не найден' });
    }

    // Ищем существующий раунд этого этапа плей-офф или создаём новый
    let round = await prisma.round.findFirst({
      where: { tournamentId, type: stageType },
      orderBy: { number: 'asc' },
    });

    if (!round) {
      const lastRound = await prisma.round.findFirst({
        where: { tournamentId },
        orderBy: { number: 'desc' },
      });
      const nextNumber = lastRound ? lastRound.number + 1 : 1;

      round = await prisma.round.create({
        data: {
          tournamentId,
          number: nextNumber,
          name: stageName || 'Плей-офф',
          type: stageType,
          format: tournament.format || 'WSDC',
          duration: 60,
          status: 'PLANNED',
        },
      });
    }

    const rooms = await prisma.room.findMany({
      where: { tournamentId },
      orderBy: { name: 'asc' },
    });

    // Перезаписываем матчи этого этапа плей-офф актуальными парами из сетки
    await prisma.match.deleteMany({ where: { roundId: round.id } });

    for (let i = 0; i < validPairs.length; i++) {
      const pair = validPairs[i];
      await prisma.match.create({
        data: {
          roundId: round.id,
          roomId: rooms[i]?.id || null,
          status: 'DRAFT',
          teams: {
            create: [
              { teamId: pair.govTeamId, position: 'GOV' },
              { teamId: pair.oppTeamId, position: 'OPP' },
            ],
          },
        },
      });
    }

    res.json({
      success: true,
      round,
      matchesCount: validPairs.length,
    });
  } catch (error) {
    console.error('Create playoff draw error:', error);
    res.status(500).json({ error: 'Ошибка создания жеребьёвки плей-офф' });
  }
};

// 3. Публикация жеребьёвки
export const publishDraw = async (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;

    await prisma.$transaction([
      prisma.match.updateMany({
        where: { roundId },
        data: { status: 'PUBLISHED' },
      }),
      prisma.round.update({
        where: { id: roundId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Publish draw error:', error);
    res.status(500).json({ error: 'Ошибка публикации жеребьёвки' });
  }
};

// 4. Ручное редактирование дебата (свап, Drag-and-Drop, комната, судьи)
export const updateMatch = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { roomId, judgeId, swapTeams, crossSwap, addPanellist, removePanellist } = req.body;

    if (swapTeams) {
      const teams = await prisma.matchTeam.findMany({ where: { matchId } });
      const gov = teams.find((t) => t.position === 'GOV');
      const opp = teams.find((t) => t.position === 'OPP');

      if (gov && opp) {
        await prisma.$transaction([
          prisma.matchTeam.update({ where: { id: gov.id }, data: { position: 'TEMP' } }),
          prisma.matchTeam.update({ where: { id: opp.id }, data: { position: 'GOV' } }),
          prisma.matchTeam.update({ where: { id: gov.id }, data: { position: 'OPP' } }),
        ]);
      }
    }

    if (crossSwap) {
      const { targetMatchId, targetPosition, sourcePosition } = crossSwap;

      const sourceTeam = await prisma.matchTeam.findUnique({
        where: { matchId_position: { matchId, position: sourcePosition } },
      });
      const targetTeam = await prisma.matchTeam.findUnique({
        where: { matchId_position: { matchId: targetMatchId, position: targetPosition } },
      });

      if (sourceTeam && targetTeam) {
        await prisma.$transaction([
          prisma.matchTeam.update({ where: { id: sourceTeam.id }, data: { position: 'TEMP' } }),
          prisma.matchTeam.update({ where: { id: targetTeam.id }, data: { matchId, position: sourcePosition } }),
          prisma.matchTeam.update({ where: { id: sourceTeam.id }, data: { matchId: targetMatchId, position: targetPosition } }),
        ]);
      }
    }

    if (roomId !== undefined) {
      await prisma.match.update({
        where: { id: matchId },
        data: { roomId: roomId || null },
      });
    }

    if (judgeId !== undefined) {
      const existingChair = await prisma.matchJudge.findFirst({ where: { matchId, isChair: true } });

      if (judgeId) {
        const existingJudgeInMatch = await prisma.matchJudge.findFirst({
          where: { matchId, judgeId },
        });

        if (existingJudgeInMatch) {
          await prisma.matchJudge.update({
            where: { id: existingJudgeInMatch.id },
            data: { isChair: true },
          });
          if (existingChair && existingChair.id !== existingJudgeInMatch.id) {
            await prisma.matchJudge.update({
              where: { id: existingChair.id },
              data: { isChair: false },
            });
          }
        } else if (existingChair) {
          await prisma.matchJudge.update({
            where: { id: existingChair.id },
            data: { judgeId, isChair: true },
          });
        } else {
          await prisma.matchJudge.create({
            data: { matchId, judgeId, isChair: true },
          });
        }
      } else if (existingChair) {
        await prisma.matchJudge.delete({ where: { id: existingChair.id } });
      }
    }

    if (addPanellist) {
      const exists = await prisma.matchJudge.findUnique({
        where: { matchId_judgeId: { matchId, judgeId: addPanellist } },
      });
      if (!exists) {
        await prisma.matchJudge.create({ data: { matchId, judgeId: addPanellist, isChair: false } });
      }
    }

    if (removePanellist) {
      await prisma.matchJudge.delete({
        where: { matchId_judgeId: { matchId, judgeId: removePanellist } },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({ error: 'Ошибка обновления дебата' });
  }
};
