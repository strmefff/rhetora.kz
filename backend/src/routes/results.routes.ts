import { Router } from 'express';
import { 
  getTournamentResultsOverview, 
  getRoundMatchesResults, 
  getWsdcStandings 
} from '../controllers/results.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

// Используем реальные функции из твоего auth.middleware.ts
router.use(requireAuth, requireRole(['ORGANIZER', 'SUPERADMIN']));

router.get('/overview', getTournamentResultsOverview);
router.get('/rounds/:roundId', getRoundMatchesResults);
router.get('/standings', getWsdcStandings);

export default router;
