import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import tournamentRoutes from './routes/tournament.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import judgeRoutes from './routes/judge.routes';
import { errorHandler } from './middleware/error.middleware';
import resultsRouter from './routes/results.routes';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/tournaments/:tournamentId/results', resultsRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
