import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export const getTournamentBallots = async (req: AuthRequest, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: 'asc' },
      include: {
        matches: {
          include: {
            room: true,
            teams: {
              include: {
                team: { include: { members: true } },
                participant: true,
              },
            },
            judges: {
              include: {
                judge: {
                  include: {
                    user: { select: { id: true, name: true, email: true } }
                  }
                },
                ballot: true,
              },
            },
          },
        },
      },
    });

    res.json(rounds);
  } catch (error: any) {
    console.error('Error fetching tournament ballots:', error);
    res.status(500).json({ error: 'Ошибка при загрузке бюллетеней турнира' });
  }
};

export const saveBallotDraftOrSubmit = async (req: AuthRequest, res: Response) => {
  const { assignmentId } = req.params;
  const { notes, draftData, status } = req.body;

  try {
    const matchJudge = await prisma.matchJudge.findUnique({
      where: { id: assignmentId },
      include: { judge: true }
    });

    if (!matchJudge || matchJudge.judge.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Нет доступа к этому бюллетеню' });
    }

    // Если в вашем регламенте боковые судьи вообще не должны заполнять бюллетени:
    // if (!matchJudge.isChair && status === 'SUBMITTED') {
    //   return res.status(403).json({ error: 'Только главный судья (Chair) может отправлять официальный бюллетень матча' });
    // }

    const ballot = await prisma.ballot.upsert({
      where: { matchJudgeId: assignmentId },
      update: {
        status: status || 'DRAFT',
        notes: notes || '',
        draftData: JSON.stringify(draftData || {}),
        ...(status === 'SUBMITTED' ? { submittedAt: new Date() } : {})
      },
      create: {
        matchJudgeId: assignmentId,
        status: status || 'DRAFT',
        notes: notes || '',
        draftData: JSON.stringify(draftData || {}),
        ...(status === 'SUBMITTED' ? { submittedAt: new Date() } : {})
      }
    });

    res.json(ballot);
  } catch (error: any) {
    console.error('Error saving ballot:', error);
    res.status(500).json({ error: 'Ошибка сохранения бюллетеня' });
  }
};
