import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// 1. Общая статистика и раунды турнира
export const getTournamentResultsOverview = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: 'asc' },
      include: {
        matches: {
          include: {
            judges: {
              include: {
                ballot: true,
              },
            },
          },
        },
      },
    });

    let totalGames = 0;
    let completedGames = 0;
    let totalBallotsSubmitted = 0;
    let totalBallotsExpected = 0;

    const roundsSummary = rounds.map((round) => {
      let roundGames = round.matches.length;
      let roundSubmitted = 0;
      let roundExpected = 0;
      let roundCompleted = 0;

      round.matches.forEach((match) => {
        totalGames++;
        const judgeCount = match.judges.length;
        roundExpected += judgeCount;
        totalBallotsExpected += judgeCount;

        let matchSubmittedCount = 0;
        match.judges.forEach((j) => {
          if (j.ballot?.status === 'SUBMITTED') {
            roundSubmitted++;
            totalBallotsSubmitted++;
            matchSubmittedCount++;
          }
        });

        if (judgeCount > 0 && matchSubmittedCount >= 1) {
          roundCompleted++;
          completedGames++;
        }
      });

      let status = 'NOT_STARTED';
      if (roundCompleted > 0 && roundCompleted < roundGames) {
        status = 'IN_PROGRESS';
      } else if (roundCompleted === roundGames && roundGames > 0) {
        status = 'COMPLETED';
      } else if (roundSubmitted > 0) {
        status = 'WAITING_FOR_BALLOTS';
      }

      return {
        id: round.id,
        number: round.number,
        name: round.name,
        format: round.format,
        status,
        matchesCount: roundGames,
        completedMatchesCount: roundCompleted,
        ballotsSubmitted: roundSubmitted,
        ballotsExpected: roundExpected,
      };
    });

    res.json({
      stats: {
        totalGames,
        completedGames,
        totalBallotsSubmitted,
        totalBallotsExpected,
        pendingBallots: Math.max(0, totalBallotsExpected - totalBallotsSubmitted),
      },
      rounds: roundsSummary,
    });
  } catch (error: any) {
    console.error('Error fetching results overview:', error);
    res.status(500).json({ error: 'Ошибка при загрузке обзора результатов' });
  }
};

// 2. Результаты игр конкретного раунда
export const getRoundMatchesResults = async (req: AuthRequest, res: Response) => {
  const { roundId } = req.params;

  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        matches: {
          include: {
            room: true,
            teams: {
              include: {
                team: { include: { members: true } },
              },
            },
            judges: {
              include: {
                judge: true,
                ballot: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Раунд не найден' });
    }

    const matchesFormatted = round.matches.map((match, idx) => {
      let submittedCount = 0;
      let winner: string | null = null;

      match.judges.forEach((j) => {
        if (j.ballot?.status === 'SUBMITTED') {
          submittedCount++;
          try {
            const draft = JSON.parse(j.ballot.draftData || '{}');
            if (draft.winner) winner = draft.winner;
          } catch (e) {}
        }
      });

      const isCompleted = submittedCount > 0;

      return {
        id: match.id,
        gameNumber: idx + 1,
        room: match.room,
        teams: match.teams,
        judges: match.judges,
        winner,
        submittedCount,
        totalJudges: match.judges.length,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
      };
    });

    res.json({
      roundId: round.id,
      roundNumber: round.number,
      roundName: round.name,
      format: round.format,
      matches: matchesFormatted,
    });
  } catch (error: any) {
    console.error('Error fetching round matches results:', error);
    res.status(500).json({ error: 'Ошибка загрузки результатов раунда' });
  }
};

// 3. Турнирная таблица WSDC (Leaderboard)
export const getWsdcStandings = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const teams = await prisma.team.findMany({
      where: { tournamentId },
      include: {
        members: true,
        matchTeams: {
          include: {
            match: {
              include: {
                round: true,
                judges: {
                  include: {
                    ballot: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const standings = teams.map((team) => {
      let wins = 0;
      let losses = 0;
      let totalSpeakerScore = 0;
      let matchesPlayed = 0;

      const memberIds = new Set(team.members.map((m) => m.id));

      team.matchTeams.forEach((mt) => {
        const match = mt.match;
        const position = mt.position;

        let matchWinner: string | null = null;
        let speakerScoresMap: Record<string, any> = {};

        match.judges.forEach((j) => {
          if (j.ballot?.status === 'SUBMITTED') {
            try {
              const draft = JSON.parse(j.ballot.draftData || '{}');
              if (draft.winner) matchWinner = draft.winner;
              
              if (draft.speakerScores) {
                Object.assign(speakerScoresMap, draft.speakerScores);
              }
            } catch (e) {}
          }
        });

        if (matchWinner) {
          matchesPlayed++;
          if (matchWinner === position) {
            wins++;
          } else {
            losses++;
          }
        }

        memberIds.forEach((mId) => {
          const scoreKey = `${position}_${mId}`;
          const sc = speakerScoresMap[scoreKey];
          
          if (sc) {
            const total = Number(sc.style || 0) + Number(sc.content || 0) + Number(sc.strategy || 0);
            totalSpeakerScore += total;
          }
        });
      });

      return {
        teamId: team.id,
        teamName: team.name,
        organization: team.organization,
        wins,
        losses,
        matchesPlayed,
        totalSpeakerScore: Number(totalSpeakerScore.toFixed(1)),
      };
    });

    standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalSpeakerScore - a.totalSpeakerScore;
    });

    const rankedStandings = standings.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    res.json(rankedStandings);
  } catch (error: any) {
    console.error('Error calculating standings:', error);
    res.status(500).json({ error: 'Ошибка расчёта турнирной таблицы' });
  }
};

// 4. Рейтинг спикеров (Best Speaker Standings через связь с командами)
export const getSpeakerStandings = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;

  try {
    let prelimRounds = await prisma.round.findMany({
      where: { tournamentId, type: 'PRELIMINARY' },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, name: true },
    });

    if (prelimRounds.length === 0) {
      prelimRounds = await prisma.round.findMany({
        where: { tournamentId },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, name: true },
      });
    }

    const prelimRoundIds = new Set(prelimRounds.map((r) => r.id));

    // Получаем команды вместе с участниками и матчами (точно так же, как в командной таблице)
    const teams = await prisma.team.findMany({
      where: { tournamentId },
      include: {
        members: true,
        matchTeams: {
          include: {
            match: {
              include: {
                round: true,
                judges: {
                  include: {
                    ballot: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const speakerStatsMap = new Map<string, {
      participantId: string;
      firstName: string;
      lastName: string;
      teamName: string;
      organization: string;
      debatesCount: number;
      totalScore: number;
      roundScores: Record<string, number>;
    }>();

    teams.forEach((team) => {
      const members = team.members || [];

      team.matchTeams.forEach((mt) => {
        const match = mt.match;
        if (!prelimRoundIds.has(match.roundId)) return;

        const position = mt.position; // 'GOV' или 'OPP'

        let speakerScoresMap: Record<string, any> = {};
        match.judges.forEach((j) => {
          if (j.ballot?.status === 'SUBMITTED') {
            try {
              const draft = JSON.parse(j.ballot.draftData || '{}');
              if (draft.speakerScores) {
                Object.assign(speakerScoresMap, draft.speakerScores);
              }
            } catch (e) {}
          }
        });

        members.forEach((p) => {
          if (!speakerStatsMap.has(p.id)) {
            speakerStatsMap.set(p.id, {
              participantId: p.id,
              firstName: p.firstName,
              lastName: p.lastName,
              teamName: team.name,
              organization: team.organization || '—',
              debatesCount: 0,
              totalScore: 0,
              roundScores: {},
            });
          }

          const speakerStat = speakerStatsMap.get(p.id)!;

          // Ищем баллы по ключам формата ${position}_${p.id} или чистому p.id
          let sc = null;
          const possibleKeys = [`${position}_${p.id}`, p.id];

          for (const k of possibleKeys) {
            if (speakerScoresMap[k]) {
              sc = speakerScoresMap[k];
              break;
            }
          }

          if (!sc) {
            const foundKey = Object.keys(speakerScoresMap).find((k) => k.includes(p.id));
            if (foundKey) sc = speakerScoresMap[foundKey];
          }

          if (sc) {
            const sTotal = Number(sc.style || 0) + Number(sc.content || 0) + Number(sc.strategy || 0) + Number(sc.total || 0);

            if (sTotal > 0) {
              speakerStat.debatesCount++;
              speakerStat.totalScore += sTotal;
              speakerStat.roundScores[match.roundId] = Number(sTotal.toFixed(1));
            }
          }
        });
      });
    });

    const speakerStats = Array.from(speakerStatsMap.values());

    speakerStats.forEach((s) => {
      s.totalScore = Number(s.totalScore.toFixed(1));
    });

    speakerStats.sort((a, b) => b.totalScore - a.totalScore);

    const rankedSpeakers = speakerStats.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    res.json({
      prelimRounds,
      speakers: rankedSpeakers,
    });
  } catch (error: any) {
    console.error('Error calculating speaker standings:', error);
    res.status(500).json({ error: 'Ошибка расчёта рейтинга спикеров' });
  }
};

