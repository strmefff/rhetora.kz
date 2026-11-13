import { Router } from 'express';
import {
  register,
  login,
  judgeMagicLogin,
  getProfile,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/judge-magic', judgeMagicLogin);

router.get('/me', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.put('/password', requireAuth, changePassword);

export default router;
