import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Trophy, Search, Award, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config/api';

export const StandingsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ prelimRounds: any[]; speakers: any[] }>({ prelimRounds: [], speakers: [] });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchSpeakerStandings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/results/speakers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (res.ok) {
          setData(result);
        } else {
          showError(result.error || 'Не удалось загрузить рейтинг спикеров');
        }
      } catch (err: any) {
        showError('Ошибка сети при загрузке рейтинга', { message: err.message });
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId && token) {
      fetchSpeakerStandings();
    }
  }, [tournamentId, token]);

  const filteredSpeakers = data.speakers.filter((s) => {
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const team = s.teamName.toLowerCase();
    const org = s.organization.toLowerCase();
    const q = searchQuery.toLowerCase();
    return fullName.includes(q) || team.includes(q) || org.includes(q);
  });

  // Функция скачивания/печати PDF рейтинга спикеров
  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError('Разрешите всплывающие окна для скачивания PDF');
      return;
    }

    const roundsHeaders = data.prelimRounds.map((r) => `<th class="center">Р${r.number}</th>`).join('');

    const rowsHtml = data.speakers
      .map((speaker) => {
        const roundCells = data.prelimRounds
          .map((r) => `<td class="center">${speaker.roundScores[r.id] !== undefined ? speaker.roundScores[r.id] : '—'}</td>`)
          .join('');

        return `
          <tr>
            <td class="rank">#${speaker.rank}</td>
            <td class="speaker">${speaker.firstName} ${speaker.lastName}</td>
            <td>
              <div style="font-weight: bold; color: #1e293b;">${speaker.teamName}</div>
              <div class="org">${speaker.organization}</div>
            </td>
            ${roundCells}
            <td class="score">${speaker.totalScore}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Личный рейтинг спикеров (Best Speaker)</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 30px; margin: 0; }
            h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
            p.subtitle { font-size: 13px; color: #64748b; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: middle; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
            .rank { font-weight: bold; text-align: center; width: 60px; color: #0f172a; }
            .speaker { font-weight: bold; color: #0f172a; }
            .org { font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px; }
            .score { font-weight: bold; text-align: right; color: #0284c7; }
            .center { text-align: center; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Личный рейтинг спикеров (Best Speaker)</h1>
          <p class="subtitle">Официальная таблица результатов турнира • Сгенерировано в системе Rhetora</p>
          <table>
            <thead>
              <tr>
                <th class="center">Место</th>
                <th>Спикер</th>
                <th>Команда / Организация</th>
                ${roundsHeaders}
                <th style="text-align: right;">Итого баллов</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };


  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="text-rhetora-teal" /> Личный рейтинг спикеров (Best Speaker)
          </h1>
          <p className="text-sm text-slate-500">
            Сумма спикерских баллов рассчитывается строго по отборочным раундам для обеспечения равных условий
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Кнопка экспорта в PDF */}
          {data.speakers.length > 0 && !loading && (
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-semibold transition text-slate-700 shadow-sm cursor-pointer"
              title="Скачать PDF таблицу рейтинга спикеров"
            >
              <Download size={16} /> PDF
            </button>
          )}

          {/* Поиск по спикерам */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, команде..."
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-800 shadow-sm focus:outline-none focus:border-rhetora-teal"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        {loading ? (
          <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
        ) : data.speakers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Участники или оценки за отборочные раунды ещё не добавлены.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase font-bold">
                  <th className="py-3 px-3 w-16">Место</th>
                  <th className="py-3 px-3">Спикер</th>
                  <th className="py-3 px-3">Команда / Организация</th>
                  {data.prelimRounds.map((r) => (
                    <th key={r.id} className="py-3 px-3 text-center">
                      Р{r.number}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right">Итого баллов</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSpeakers.map((speaker) => (
                  <tr key={speaker.participantId} className="hover:bg-slate-50/50 transition font-medium">
                    <td className="py-3.5 px-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                      {speaker.rank === 1 && <Trophy size={14} className="text-amber-500" />}
                      {speaker.rank === 2 && <Trophy size={14} className="text-slate-400" />}
                      {speaker.rank === 3 && <Trophy size={14} className="text-amber-700" />}
                      <span>#{speaker.rank}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">
                        {speaker.firstName} {speaker.lastName}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-slate-800 font-bold">{speaker.teamName}</div>
                      <div className="text-xs text-slate-500">{speaker.organization}</div>
                    </td>
                    {data.prelimRounds.map((r) => (
                      <td key={r.id} className="py-3.5 px-3 text-center text-slate-600">
                        {speaker.roundScores[r.id] !== undefined ? speaker.roundScores[r.id] : '—'}
                      </td>
                    ))}
                    <td className="py-3.5 px-3 text-right font-extrabold text-rhetora-teal text-base">
                      {speaker.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
