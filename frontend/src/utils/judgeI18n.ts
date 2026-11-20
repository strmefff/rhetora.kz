import { useEffect, useState } from 'react';

export type JudgeLang = 'ru' | 'kz';

const STORAGE_KEY = 'rhetora_judge_lang';
const EVENT_NAME = 'rhetora-judge-lang';

export const getJudgeLang = (): JudgeLang => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'kz' || saved === 'ru') return saved;
  } catch {}
  return 'ru';
};

export const setJudgeLang = (lang: JudgeLang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const JUDGE_TRANSLATIONS = {
  ru: {
    // Layout
    judgeFallback: 'Судья',
    judgeCabinet: 'Кабинет судьи',
    backToOrganizerTitle: 'Вернуться в панель организатора',
    organizerBtn: 'Организатор',
    judgingPanel: 'Судейская коллегия',
    logoutTitle: 'Выйти из аккаунта',
    logoutBtn: 'Выйти',

    // Dashboard statuses & tabs
    statusSubmitted: 'Отправлен',
    statusDraft: 'Черновик',
    statusPending: 'Ожидает заполнения',
    personalCabinetFallback: 'Личный кабинет судьи',
    uploadAvatarTitle: 'Нажмите, чтобы загрузить или обновить фото',
    removeAvatarTitle: 'Удалить фото',
    judgeBadge: 'Судья',
    tabGames: 'Игры',
    tabTimer: 'Таймер',
    tabProfile: 'Профиль',

    // Dashboard games
    statTotal: 'Всего игр',
    statSubmitted: 'Сдано',
    statPending: 'Ждут',
    assignedDebates: 'Назначенные дебаты',
    byRounds: 'По раундам',
    noGamesTitle: 'Игр пока нет',
    noGamesDesc: 'Как только организатор распределит вас на дебаты, карточки игр появятся здесь.',
    roundLabel: (n: number) => `Раунд ${n}`,
    gameLabel: (n: number) => `Игра #${n}`,
    chairBadge: 'Чейр',
    wingBadge: 'Боковой',
    noRoom: 'Аудитория не назначена',
    viewBallot: 'Просмотреть бюллетень',
    openBallot: 'Открыть игру и бюллетень',

    // Dashboard timer
    timerTitle: 'Таймер речи спикера',
    timerSubtitle: 'Регламент с авто-сигналами (гонг)',
    gongTitle: 'Издать звуковой гонг вручную',
    gongBtn: 'Звонок',
    preset5m: '5 минут (Основная)',
    preset3m: '3 минуты (Аналитика)',
    protectedFirst: '🛡️ Первая минута (Защищенное время)',
    protectedLast: '🛡️ Последняя минута (Защищенное время)',
    poiOpen: '💬 Время вопросов (POI открыты)',
    timeUp: 'Время вышло!',
    timerRunning: 'Идёт отсчёт...',
    timerPaused: 'Пауза',
    btnPause: 'Пауза',
    btnStart: 'Старт',
    add15Title: 'Добавить 15 секунд',
    btn15s: '15 сек',
    btnReset: 'Сброс',

    // Dashboard profile
    personalDataTitle: 'Личные данные',
    personalDataDesc: 'Обновите ваше имя или адрес электронной почты',
    yourNameLabel: 'Ваше имя',
    emailLabel: 'Email (Электронная почта)',
    savingBtn: 'Сохранение...',
    saveChangesBtn: 'Сохранить изменения',
    securityTitle: 'Безопасность и пароль',
    securityDesc: 'Регулярно меняйте пароль для защиты аккаунта',
    currentPassLabel: 'Текущий пароль',
    newPassLabel: 'Новый пароль',
    confirmPassLabel: 'Подтвердите новый пароль',
    changingBtn: 'Изменение...',
    changePassBtn: 'Изменить пароль',

    // Dashboard toasts
    errLoadCabinet: 'Не удалось загрузить кабинет судьи',
    errNetworkLoad: 'Ошибка сети при загрузке данных',
    errImageFormat: 'Выберите файл изображения (JPG, PNG, WebP)',
    okAvatarUpdated: 'Аватарка обновлена',
    errProcessPhoto: 'Не удалось обработать фото',
    okAvatarRemoved: 'Аватарка удалена',
    okProfileUpdated: 'Профиль успешно обновлён!',
    errSaveProfile: 'Ошибка сохранения профиля',
    errNetwork: 'Ошибка сети',
    errPassMismatch: 'Новые пароли не совпадают',
    errPassMin: 'Пароль должен быть не менее 6 символов',
    okPassChanged: 'Пароль успешно изменён!',
    errPassChange: 'Ошибка смены пароля',

    // Match page positions
    positions: {
      GOV: 'Правительство (GOV)',
      OPP: 'Оппозиция (OPP)',
      OG: 'Первое правительство (OG)',
      OO: 'Первая оппозиция (OO)',
      CG: 'Второе правительство (CG)',
      CO: 'Вторая оппозиция (CO)',
      AFF: 'Утверждение (AFF)',
      NEG: 'Отрицание (NEG)',
    } as Record<string, string>,

    // Match page UI
    backToMyGames: 'Назад к моим играм',
    syncSaving: 'Сохранение...',
    syncSaved: 'Сохранено',
    syncSavedAt: (time: string) => `Сохранено в ${time}`,
    syncOffline: 'На телефоне (ожидание сети)',
    matchHeading: (rNum: number, rName: string, gNum: number) =>
      `Раунд ${rNum} · ${rName} — Игра #${gNum}`,
    viewOnlyWing: 'Только просмотр (Боковой)',
    roomLabel: 'Аудитория',
    roomNotAssigned: 'Не назначена',
    assignedJudgeLabel: 'Назначенный судья',
    chairFull: 'Главный судья (Чейр)',
    wingFull: 'Боковой судья',
    debateFormatLabel: 'Формат дебатов',
    wingNoticeTitle: 'Режим просмотра:',
    wingNoticeBody:
      'Вы назначены боковым судьей (Винг). Вы можете изучать составы и оставлять личные заметки, но заполнять протокол и отправлять официальный бюллетень может только Главный судья (Чейр).',
    protocolTitle: 'Судейский протокол и спикерские баллы',
    protocolSubtitle:
      'Критерии: Стиль (до 40), Контент (до 40), Стратегия (до 20). Прогресс сохраняется автоматически.',
    teamTbd: 'Команда TBD',
    teamTotal: (sum: number) => `Сумма команды: ${sum}`,
    speakerTotal: (total: number) => `Итого: ${total} / 100`,
    critStyle: 'Стиль (/40)',
    critContent: 'Контент (/40)',
    critStrategy: 'Стратегия (/20)',
    noSpeakers: 'Состав спикеров не указан',
    winnerLabel: 'Победитель дебатов (Фракция) *',
    govBtn: 'Правительство (GOV)',
    oppBtn: 'Оппозиция (OPP)',
    notesLabel: 'Обоснование решения и столкновения (Oral Adjudication / Notes)',
    notesPlaceholder: 'Опишите ключевые клэши и аргументы победившей стороны...',
    saveDraftBtn: 'Сохранить черновик',
    submitBallotBtn: 'Отправить бюллетень',

    // Confirm modal
    confirmTitle: 'Подтвердите отправку',
    confirmWinner: 'Победитель:',
    pointsUnit: (n: number) => `${n} баллов`,
    confirmWarning:
      'После отправки бюллетень попадёт в табуляцию турнира и редактирование будет заблокировано.',
    confirmCancel: 'Вернуться',
    confirmSending: 'Отправка...',
    confirmSubmit: 'Подтвердить отправку',

    // Match toasts
    errNoMatchAccess: 'Нет доступа к этой игре',
    errUnstableLoad:
      'Нестабильное соединение при загрузке игры. Проверьте интернет и обновите страницу.',
    okDraftSaved: 'Черновик бюллетеня сохранён',
    errServerSaveOffline: 'Не удалось сохранить на сервер — данные сохранены на телефоне',
    errNoServerOffline: 'Нет связи с сервером — баллы надёжно сохранены в памяти телефона',
    errSelectWinner: 'Пожалуйста, выберите победителя дебатов перед отправкой',
    okBallotSubmitted: 'Бюллетень успешно отправлен!',
    errSubmitBallot: 'Ошибка отправки бюллетеня. Попробуйте ещё раз.',
    errWeakInternetSubmit:
      'Слабый интернет: сервер не ответил вовремя. Все баллы сохранены на телефоне — нажмите «Подтвердить отправку» ещё раз.',
  },
  kz: {
    // Layout
    judgeFallback: 'Төреші',
    judgeCabinet: 'Төреші кабинеті',
    backToOrganizerTitle: 'Ұйымдастырушы панеліне оралу',
    organizerBtn: 'Ұйымдастырушы',
    judgingPanel: 'Төрешілер алқасы',
    logoutTitle: 'Аккаунттан шығу',
    logoutBtn: 'Шығу',

    // Dashboard statuses & tabs
    statusSubmitted: 'Жіберілді',
    statusDraft: 'Жоба',
    statusPending: 'Толтыруды күтуде',
    personalCabinetFallback: 'Төрешінің жеке кабинеті',
    uploadAvatarTitle: 'Фотоны жүктеу немесе жаңарту үшін басыңыз',
    removeAvatarTitle: 'Фотоны жою',
    judgeBadge: 'Төреші',
    tabGames: 'Ойындар',
    tabTimer: 'Таймер',
    tabProfile: 'Профиль',

    // Dashboard games
    statTotal: 'Барлық ойын',
    statSubmitted: 'Тапсырылды',
    statPending: 'Күтілуде',
    assignedDebates: 'Тағайындалған дебаттар',
    byRounds: 'Раундтар бойынша',
    noGamesTitle: 'Әзірге ойындар жоқ',
    noGamesDesc:
      'Ұйымдастырушы сізді дебаттарға бөлген бойда, ойын карточкалары осында пайда болады.',
    roundLabel: (n: number) => `${n}-раунд`,
    gameLabel: (n: number) => `#${n} ойын`,
    chairBadge: 'Чейр',
    wingBadge: 'Бүйір төреші',
    noRoom: 'Аудитория тағайындалмаған',
    viewBallot: 'Бюллетеньді қарау',
    openBallot: 'Ойын мен бюллетеньді ашу',

    // Dashboard timer
    timerTitle: 'Спикер сөзінің таймері',
    timerSubtitle: 'Авто-сигналдары бар регламент (гонг)',
    gongTitle: 'Дыбыстық гонгты қолмен беру',
    gongBtn: 'Қоңырау',
    preset5m: '5 минут (Негізгі)',
    preset3m: '3 минут (Сараптама)',
    protectedFirst: '🛡️ Бірінші минут (Қорғалған уақыт)',
    protectedLast: '🛡️ Соңғы минут (Қорғалған уақыт)',
    poiOpen: '💬 Сұрақтар уақыты (POI ашық)',
    timeUp: 'Уақыт аяқталды!',
    timerRunning: 'Уақыт жүріп жатыр...',
    timerPaused: 'Кідіріс',
    btnPause: 'Кідіріс',
    btnStart: 'Бастау',
    add15Title: '15 секунд қосу',
    btn15s: '15 сек',
    btnReset: 'Қалпына келтіру',

    // Dashboard profile
    personalDataTitle: 'Жеке деректер',
    personalDataDesc: 'Атыңызды немесе электрондық поштаңызды жаңартыңыз',
    yourNameLabel: 'Сіздің атыңыз',
    emailLabel: 'Email (Электрондық пошта)',
    savingBtn: 'Сақталуда...',
    saveChangesBtn: 'Өзгерістерді сақтау',
    securityTitle: 'Қауіпсіздік және құпиясөз',
    securityDesc: 'Аккаунтты қорғау үшін құпиясөзді үнемі жаңартып отырыңыз',
    currentPassLabel: 'Ағымдағы құпиясөз',
    newPassLabel: 'Жаңа құпиясөз',
    confirmPassLabel: 'Жаңа құпиясөзді растаңыз',
    changingBtn: 'Өзгертілуде...',
    changePassBtn: 'Құпиясөзді өзгерту',

    // Dashboard toasts
    errLoadCabinet: 'Төреші кабинетін жүктеу мүмкін болмады',
    errNetworkLoad: 'Деректерді жүктеу кезінде желі қатесі орын алды',
    errImageFormat: 'Сурет файлын таңдаңыз (JPG, PNG, WebP)',
    okAvatarUpdated: 'Аватар жаңартылды',
    errProcessPhoto: 'Фотоны өңдеу мүмкін болмады',
    okAvatarRemoved: 'Аватар жойылды',
    okProfileUpdated: 'Профиль сәтті жаңартылды!',
    errSaveProfile: 'Профильді сақтау қатесі',
    errNetwork: 'Желі қатесі',
    errPassMismatch: 'Жаңа құпиясөздер сәйкес келмейді',
    errPassMin: 'Құпиясөз кемінде 6 таңбадан тұруы керек',
    okPassChanged: 'Құпиясөз сәтті өзгертілді!',
    errPassChange: 'Құпиясөзді өзгерту қатесі',

    // Match page positions
    positions: {
      GOV: 'Үкімет (GOV)',
      OPP: 'Оппозиция (OPP)',
      OG: 'Бірінші үкімет (OG)',
      OO: 'Бірінші оппозиция (OO)',
      CG: 'Екінші үкімет (CG)',
      CO: 'Екінші оппозиция (CO)',
      AFF: 'Жақтаушы (AFF)',
      NEG: 'Даттаушы (NEG)',
    } as Record<string, string>,

    // Match page UI
    backToMyGames: 'Ойындарыма оралу',
    syncSaving: 'Сақталуда...',
    syncSaved: 'Сақталды',
    syncSavedAt: (time: string) => `${time} сақталды`,
    syncOffline: 'Телефонда (желі күтілуде)',
    matchHeading: (rNum: number, rName: string, gNum: number) =>
      `${rNum}-раунд · ${rName} — #${gNum} ойын`,
    viewOnlyWing: 'Тек қарау (Бүйір төреші)',
    roomLabel: 'Аудитория',
    roomNotAssigned: 'Тағайындалмаған',
    assignedJudgeLabel: 'Тағайындалған төреші',
    chairFull: 'Бас төреші (Чейр)',
    wingFull: 'Бүйір төреші',
    debateFormatLabel: 'Дебат форматы',
    wingNoticeTitle: 'Қарау режимі:',
    wingNoticeBody:
      'Сіз бүйір төреші (Винг) болып тағайындалдыңыз. Құрамдарды қарап, жеке жазбалар қалдыра аласыз, бірақ хаттаманы толтырып, ресми бюллетеньді тек Бас төреші (Чейр) жібере алады.',
    protocolTitle: 'Төреші хаттамасы және спикерлік ұпайлар',
    protocolSubtitle:
      'Критерийлер: Стиль (40-қа дейін), Контент (40-қа дейін), Стратегия (20-ға дейін). Прогресс автоматты түрде сақталады.',
    teamTbd: 'Команда TBD',
    teamTotal: (sum: number) => `Команда жиынтығы: ${sum}`,
    speakerTotal: (total: number) => `Барлығы: ${total} / 100`,
    critStyle: 'Стиль (/40)',
    critContent: 'Контент (/40)',
    critStrategy: 'Стратегия (/20)',
    noSpeakers: 'Спикерлер құрамы көрсетілмеген',
    winnerLabel: 'Дебат жеңімпазы (Фракция) *',
    govBtn: 'Үкімет (GOV)',
    oppBtn: 'Оппозиция (OPP)',
    notesLabel: 'Шешім негіздемесі және негізгі қақтығыстар (Oral Adjudication / Notes)',
    notesPlaceholder: 'Негізгі клэштер мен жеңген тараптың дәлелдерін сипаттаңыз...',
    saveDraftBtn: 'Жобаны сақтау',
    submitBallotBtn: 'Бюллетеньді жіберу',

    // Confirm modal
    confirmTitle: 'Жіберуді растаңыз',
    confirmWinner: 'Жеңімпаз:',
    pointsUnit: (n: number) => `${n} ұпай`,
    confirmWarning:
      'Жіберілгеннен кейін бюллетень турнир табуляциясына түседі және өңдеу бұғатталады.',
    confirmCancel: 'Қайту',
    confirmSending: 'Жіберілуде...',
    confirmSubmit: 'Жіберуді растау',

    // Match toasts
    errNoMatchAccess: 'Бұл ойынға қолжетімділік жоқ',
    errUnstableLoad:
      'Ойынды жүктеу кезінде байланыс тұрақсыз болды. Интернетті тексеріп, бетті жаңартыңыз.',
    okDraftSaved: 'Бюллетень жобасы сақталды',
    errServerSaveOffline: 'Серверге сақтау мүмкін болмады — деректер телефонда сақталды',
    errNoServerOffline: 'Сервермен байланыс жоқ — ұпайлар телефон жадында сенімді сақталды',
    errSelectWinner: 'Жібермес бұрын дебат жеңімпазын таңдаңыз',
    okBallotSubmitted: 'Бюллетень сәтті жіберілді!',
    errSubmitBallot: 'Бюллетеньді жіберу қатесі. Қайталап көріңіз.',
    errWeakInternetSubmit:
      'Интернет әлсіз: сервер уақытылы жауап бермеді. Барлық ұпайлар телефонда сақталды — «Жіберуді растау» батырмасын қайта басыңыз.',
  },
};

export const useJudgeLang = () => {
  const [lang, setLangState] = useState<JudgeLang>(getJudgeLang);

  useEffect(() => {
    const sync = () => setLangState(getJudgeLang());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    lang,
    setLang: setJudgeLang,
    t: JUDGE_TRANSLATIONS[lang],
  };
};
