import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Утилита для случайного перемешивания массива (Алгоритм Фишера — Йетса)
const shuffleArray = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateDrawService = async (roundId: string, format: string, tournamentId: string) => {
  // 1. Очищаем старый черновик этого раунда
  await prisma.match.deleteMany({ where: { roundId, status: 'DRAFT' } });

  // 2. Получаем все ресурсы турнира (без сортировки по рейтингу/посеву)
  const rooms = await prisma.room.findMany({ where: { tournamentId } });
  const judges = await prisma.judge.findMany({ where: { tournamentId } });
  const teams = await prisma.team.findMany({ where: { tournamentId } });
  const participants = await prisma.participant.findMany({ where: { tournamentId } });

  // 3. ПОЛНОСТЬЮ РАНДОМИЗИРУЕМ ВСЕ МАССИВЫ
  const shuffledRooms = shuffleArray(rooms);
  const shuffledJudges = shuffleArray(judges);
  const shuffledTeams = shuffleArray(teams);
  const shuffledParticipants = shuffleArray(participants);

  let matchesData: any[] = [];

  // Алгоритм ВШФ (WSDC) - 2 команды в дебате
  if (format === 'WSDC') {
    for (let i = 0; i < shuffledTeams.length; i += 2) {
      if (shuffledTeams[i + 1]) {
        matchesData.push({
          roundId,
          // Выдаем уникальную случайную комнату
          roomId: shuffledRooms[i / 2]?.id || null, 
          teams: {
            create: [
              { teamId: shuffledTeams[i].id, position: 'GOV' },
              { teamId: shuffledTeams[i + 1].id, position: 'OPP' }
            ]
          },
          judges: {
            // Выдаем уникального случайного судью
            create: shuffledJudges[i / 2] ? [{ judgeId: shuffledJudges[i / 2].id, isChair: true }] : []
          }
        });
      }
    }
  } 
  // Алгоритм БПФ (BP) - 4 команды в дебате
  else if (format === 'BP') {
    for (let i = 0; i < shuffledTeams.length; i += 4) {
      if (shuffledTeams[i + 3]) {
        matchesData.push({
          roundId,
          roomId: shuffledRooms[i / 4]?.id || null,
          teams: {
            create: [
              { teamId: shuffledTeams[i].id, position: 'OG' },
              { teamId: shuffledTeams[i + 1].id, position: 'OO' },
              { teamId: shuffledTeams[i + 2].id, position: 'CG' },
              { teamId: shuffledTeams[i + 3].id, position: 'CO' }
            ]
          },
          judges: {
            create: shuffledJudges[i / 4] ? [{ judgeId: shuffledJudges[i / 4].id, isChair: true }] : []
          }
        });
      }
    }
  }
  // Алгоритм ЛД (LD) - 2 индивидуальных участника в дебате
  else if (format === 'LD') {
    for (let i = 0; i < shuffledParticipants.length; i += 2) {
      if (shuffledParticipants[i + 1]) {
        matchesData.push({
          roundId,
          roomId: shuffledRooms[i / 2]?.id || null,
          teams: {
            create: [
              { participantId: shuffledParticipants[i].id, position: 'AFF' },
              { participantId: shuffledParticipants[i + 1].id, position: 'NEG' }
            ]
          }
        });
      }
    }
  }

  // 4. Сохраняем новую полностью случайную жеребьёвку в БД через транзакцию
  const createdMatches = await prisma.$transaction(
    matchesData.map(data => prisma.match.create({ data }))
  );

  return createdMatches;
};
