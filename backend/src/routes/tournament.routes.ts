import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  createTournament, getTournaments, getTournamentById, updateTournament, deleteTournament 
} from '../controllers/tournament.controller';
import { 
  getRounds, createRound, updateRound, duplicateRound, deleteRound 
} from '../controllers/rounds.controller'; // 👈 Исправленный импорт контроллера раундов
import {
  getParticipants, createParticipant, updateParticipant, deleteParticipant, importParticipantsCSV, exportParticipantsCSV,
  getTeams, createTeam, deleteTeam,
  getJudges, createJudge, updateJudge, deleteJudge,
  getRooms, createRoom, deleteRoom
} from '../controllers/entities.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createDemoTournament } from '../controllers/demo.controller';
import { getDraw, generateDraw, createPlayoffDraw, publishDraw, updateMatch } from '../controllers/draw.controller';
import { getTournamentBallots } from '../controllers/ballot.controller';
import { 
  getTournamentResultsOverview, 
  getRoundMatchesResults, 
  getWsdcStandings, 
  getSpeakerStandings 
} from '../controllers/results.controller';

const prisma = new PrismaClient();
const router = Router();
router.use(requireAuth);

// Турниры и Демо
router.post('/demo', createDemoTournament);
router.post('/', createTournament);
router.get('/', getTournaments);

router.get('/:id/overview', async (req: any, res) => {
  try {
    const { id } = req.params;
    const tournament = await prisma.tournament.findUnique({ where: { id } });

    if (!tournament) {
      return res.status(404).json({ error: 'Турнир не найден' });
    }

    let teamsCount = 0;
    let participantsCount = 0;
    let judgesCount = 0;
    let roomsCount = 0;
    let roundsCount = 0;

    try {
      if (prisma.team) teamsCount = await prisma.team.count({ where: { tournamentId: id } });
      if (prisma.participant) participantsCount = await prisma.participant.count({ where: { tournamentId: id } });
      if (prisma.judge) judgesCount = await prisma.judge.count({ where: { tournamentId: id } });
      if (prisma.room) roomsCount = await prisma.room.count({ where: { tournamentId: id } });
      if (prisma.round) roundsCount = await prisma.round.count({ where: { tournamentId: id } });
    } catch (e) {}

    res.json({
      ...tournament,
      _count: {
        teams: teamsCount,
        participants: participantsCount,
        judges: judgesCount,
        rooms: roomsCount,
        rounds: roundsCount,
      },
      organizer: {
        name: 'Организатор турнира',
        email: '',
      },
    });
  } catch (error: any) {
    console.error('Overview error:', error);
    res.status(500).json({ error: 'Ошибка загрузки обзора турнира' });
  }
});

router.get('/:id', getTournamentById);
router.put('/:id', updateTournament);
router.delete('/:id', deleteTournament);

// Участники
router.get('/:tournamentId/participants', getParticipants);
router.post('/:tournamentId/participants', createParticipant);
router.put('/participants/:id', updateParticipant);
router.delete('/participants/:id', deleteParticipant);
router.post('/:tournamentId/participants/import', importParticipantsCSV);
router.get('/:tournamentId/participants/export', exportParticipantsCSV);

// Команды
router.get('/:tournamentId/teams', getTeams);
router.post('/:tournamentId/teams', createTeam);
router.delete('/teams/:id', deleteTeam);

// Судьи
router.get('/:tournamentId/judges', getJudges);
router.post('/:tournamentId/judges', createJudge);
router.put('/judges/:id', updateJudge);
router.delete('/judges/:id', deleteJudge);

// Комнаты
router.get('/:tournamentId/rooms', getRooms);
router.post('/:tournamentId/rooms', createRoom);
router.delete('/rooms/:id', deleteRoom);

// Раунды турнира
router.get('/:tournamentId/rounds', getRounds);
router.post('/:tournamentId/rounds', createRound);
router.put('/rounds/:id', updateRound);
router.post('/rounds/:id/duplicate', duplicateRound);
router.delete('/rounds/:id', deleteRound);

// Жеребьёвка
router.get('/:tournamentId/rounds/:roundId/draw', getDraw);
router.post('/:tournamentId/rounds/:roundId/draw/generate', generateDraw);
router.post('/:tournamentId/rounds/:roundId/draw/publish', publishDraw);
router.post('/:tournamentId/draw/playoffs', requireAuth, createPlayoffDraw);
router.put('/matches/:matchId', updateMatch);

// Бюллетени и статусы судейства
router.get('/:tournamentId/ballots', getTournamentBallots);

// РЕЗУЛЬТАТЫ И РЕЙТИНГИ
router.get('/:tournamentId/results/overview', getTournamentResultsOverview);
router.get('/:tournamentId/results/rounds/:roundId', getRoundMatchesResults);
router.get('/:tournamentId/results/standings', getWsdcStandings);
router.get('/:tournamentId/results/speakers', getSpeakerStandings);

export default router;
