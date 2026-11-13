import { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TEAMS = [
  { name: 'Nomad Debate', org: 'Astana Debate Club', speakers: ['Алихан Сериков', 'Дана Нурпеисова', 'Арман Тлеубергенов'] },
  { name: 'NU Phoenix', org: 'Nazarbayev University', speakers: ['Амина Касымова', 'Тимур Жумабаев', 'Сабина Омарова'] },
  { name: 'Esil Falcons', org: 'Esil University', speakers: ['Артём Соколов', 'Алина Бекетова', 'Данияр Ахметов'] },
  { name: 'Almaty Titans', org: 'КБТУ', speakers: ['Ерлан Сагындыков', 'Айгерим Нурланова', 'Мадияр Искаков'] },
  { name: 'Steppe Wolves', org: 'ЕНУ им. Гумилёва', speakers: ['Жанна Кожахметова', 'Санжар Мухамедов', 'Камила Сулейменова'] },
  { name: 'AITU Pulse', org: 'Astana IT University', speakers: ['Руслан Алиев', 'Диана Кенжебаева', 'Азамат Болатов'] },
  { name: 'KazNU Storm', org: 'КазНУ им. аль-Фараби', speakers: ['Нурлан Есенов', 'Аружан Сапарова', 'Темирлан Калиев'] },
  { name: 'Samruk Lions', org: 'KIMEP University', speakers: ['Малика Рахимова', 'Ильяс Досмагамбетов', 'Анель Тулегенова'] },
  { name: 'Baiterek Logic', org: 'НИШ ФМН Астана', speakers: ['Бекзат Оспанов', 'Томирис Абишева', 'Алишер Маратов'] },
  { name: 'SDU Sparks', org: 'SDU University', speakers: ['Айдана Мусаева', 'Ерасыл Бахытжан', 'Зарина Нургалиева'] },
  { name: 'Turan Knights', org: 'Университет Туран', speakers: ['Максим Литвинов', 'Асель Джумагулова', 'Рамиль Хасанов'] },
  { name: 'Qazaq Orators', org: 'MNU (КАЗГЮУ)', speakers: ['Султан Бекмухамбетов', 'Медина Ибраева', 'Аскар Тажибаев'] },
  { name: 'Eurasia Vanguard', org: 'МГУ КФ', speakers: ['Артём Волков', 'Лаура Смагулова', 'Дархан Каримов'] },
  { name: 'Saryarka Eagles', org: 'КарУ им. Букетова', speakers: ['Олжас Баймуратов', 'Ксения Морозова', 'Нурсултан Амангельды'] },
  { name: 'Irtysh Wave', org: 'Торайгыров Университет', speakers: ['Бауыржан Кайратов', 'Валерия Орлова', 'Мейрамбек Сеитов'] },
  { name: 'Caspian Hawks', org: 'Yessenov University', speakers: ['Куаныш Ержанов', 'София Белова', 'Алмас Досанов'] },
];

const DEMO_JUDGES = [
  { name: 'Сабина Алиева', org: 'Главный судейский корпус', category: 'CHAIR', rating: 9.5 },
  { name: 'Арман Касымов', org: 'Nazarbayev University', category: 'CHAIR', rating: 9.0 },
  { name: 'Дана Мухамедова', org: 'Astana Debate Club', category: 'CHAIR', rating: 8.8 },
  { name: 'Тимур Искаков', org: 'КБТУ', category: 'CHAIR', rating: 8.5 },
  { name: 'Айгерим Сулейменова', org: 'MNU', category: 'CHAIR', rating: 8.4 },
  { name: 'Ерлан Жумабаев', org: 'ЕНУ им. Гумилёва', category: 'CHAIR', rating: 8.2 },
  { name: 'Камила Омарова', org: 'KIMEP University', category: 'CHAIR', rating: 8.0 },
  { name: 'Мадияр Бекетов', org: 'Astana IT University', category: 'CHAIR', rating: 7.9 },
  { name: 'Жанна Кожахметова', org: 'Esil University', category: 'PANELLIST', rating: 6.8 },
  { name: 'Данияр Ахметов', org: 'КазНУ', category: 'PANELLIST', rating: 6.5 },
  { name: 'Амина Нурланова', org: 'SDU University', category: 'PANELLIST', rating: 6.2 },
  { name: 'Алихан Сагындыков', org: 'НИШ', category: 'TRAINEE', rating: 5.5 },
];

const DEMO_ROOMS = [
  { name: 'Актовый зал', building: 'Главный корпус, центральный вход', floor: 1 },
  { name: 'Каб. 201', building: 'Главный корпус, левое крыло', floor: 2 },
  { name: 'Каб. 202', building: 'Главный корпус, левое крыло', floor: 2 },
  { name: 'Каб. 203', building: 'Главный корпус, правое крыло', floor: 2 },
  { name: 'Каб. 204', building: 'Главный корпус, правое крыло', floor: 2 },
  { name: 'Каб. 301', building: 'Учебный блок Б', floor: 3 },
  { name: 'Каб. 302', building: 'Учебный блок Б', floor: 3 },
  { name: 'Каб. 305', building: 'Учебный блок Б', floor: 3 },
  { name: 'Каб. 401', building: 'Конференц-зона', floor: 4 },
  { name: 'Каб. 402', building: 'Конференц-зона', floor: 4 },
];

export const createDemoTournament = async (req: any, res: Response) => {
  try {
    // Находим актуального пользователя-организатора
    let organizerId = req.user?.id || req.user?.userId;
    if (!organizerId) {
      const fallbackUser = await prisma.user.findFirst();
      if (!fallbackUser) {
        return res.status(400).json({ error: 'В базе нет ни одного пользователя-организатора' });
      }
      organizerId = fallbackUser.id;
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Создаём турнир (WSDC)
    const tournament = await prisma.tournament.create({
      data: {
        name: `Кубок Астаны · Демо (${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`,
        description: 'Автоматически сгенерированный тестовый турнир для проверки жеребьёвки',
        city: 'Астана',
        location: 'Esil University',
        startDate: now,
        endDate: tomorrow,
        format: 'WSDC',
        roundsCount: 3,
        status: 'PREPARATION',
        organizerId,
      },
    });

    // 2. Создаём 10 аудиторий
    await Promise.all(
      DEMO_ROOMS.map((room) =>
        prisma.room.create({
          data: {
            tournamentId: tournament.id,
            name: room.name,
            building: room.building,
            floor: room.floor,
          },
        })
      )
    );

    // 3. Создаём 12 судей
    await Promise.all(
      DEMO_JUDGES.map((judge) =>
        prisma.judge.create({
          data: {
            tournamentId: tournament.id,
            name: judge.name,
            organization: judge.org,
            category: judge.category,
            rating: judge.rating,
          },
        })
      )
    );

    // 4. Создаём 16 команд и 48 участников (по 3 спикера в каждой)
    for (let i = 0; i < DEMO_TEAMS.length; i++) {
      const teamData = DEMO_TEAMS[i];
      const createdTeam = await prisma.team.create({
        data: {
          tournamentId: tournament.id,
          name: teamData.name,
          organization: teamData.org,
          city: 'Астана',
          seed: 16 - i,
        },
      });

      await Promise.all(
        teamData.speakers.map((fullName, speakerIdx) => {
          const [firstName, ...lastNameParts] = fullName.split(' ');
          return prisma.participant.create({
            data: {
              tournamentId: tournament.id,
              teamId: createdTeam.id,
              firstName: firstName || 'Участник',
              lastName: lastNameParts.join(' ') || `${speakerIdx + 1}`,
              email: `demo.t${i + 1}.s${speakerIdx + 1}@rhetora.kz`,
              organization: teamData.org,
              city: 'Астана',
            },
          });
        })
      );
    }

    // 5. Создаём 3 отборочных раунда
    await Promise.all(
      [1, 2, 3].map((roundNumber) =>
        prisma.round.create({
          data: {
            tournamentId: tournament.id,
            number: roundNumber,
            name: `Отборочный раунд ${roundNumber}`,
            type: 'PRELIMINARY',
            format: 'WSDC',
            duration: 60,
            status: 'PLANNED',
          },
        })
      )
    );

    res.status(201).json(tournament);
  } catch (error: any) {
    console.error('Ошибка создания демо-турнира:', error);
    res.status(500).json({
      error: `Ошибка БД: ${error?.message?.split('\n').pop() || 'Не удалось создать демо-турнир'}`,
    });
  }
};
