import { Router } from 'express';
import { requireAuth, requireJudge } from '../middleware/auth.middleware';
import {
  getJudgeDashboard,
  getJudgeAssignmentById,
  initOrGetBallot,
  saveBallotDraft,
  submitBallot,
} from '../controllers/judge.controller';

const router = Router();

// Все маршруты судейского модуля требуют авторизации и роли JUDGE
router.use(requireAuth, requireJudge);

router.get('/dashboard', getJudgeDashboard);
router.get('/assignments/:assignmentId', getJudgeAssignmentById);
router.post('/assignments/:assignmentId/ballot', initOrGetBallot);
router.put('/assignments/:assignmentId/ballot/draft', saveBallotDraft);
router.post('/assignments/:assignmentId/ballot/submit', submitBallot);

export default router;
