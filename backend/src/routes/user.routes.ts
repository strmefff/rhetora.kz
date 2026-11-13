import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAllUsers, updateUserRole, deleteUser } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

router.use(requireAuth);

// Получить всех пользователей для выбора в качестве судей
router.get('/list/judges', async (req: any, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка загрузки пользователей' });
  }
});


router.get('/', getAllUsers);
router.patch('/:userId/role', updateUserRole);
router.delete('/:userId', deleteUser);

export default router;
