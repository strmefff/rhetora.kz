// Заглушка для GitHub Pages: при сборке продакшена подхватится VITE_API_URL из .env.production
const PROD_API_URL = import.meta.env.VITE_API_URL?.trim() || '';

// Локально (и на Mac по localhost:5173, и на iPhone по 192.168.8.15:5173)
// возвращается пустая строка '', чтобы запросы шли на относительный путь /api/...
// и автоматически перенаправлялись через proxy в vite.config.ts на Express (127.0.0.1:3000).
export const API_BASE = PROD_API_URL ? PROD_API_URL.replace(/\/+$/, '') : '';
