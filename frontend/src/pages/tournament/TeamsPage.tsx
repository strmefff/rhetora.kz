import { API_BASE } from "../../config/api";
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, Trash2, X, Users, Printer, Pencil, UserPlus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const TEAM_EMOJIS = ['🚀', '🔥', '⚡', '💡', '🏆', '🎯', '🦁', '🦅', '🐺', '⭐', '💎', '⚔️', '🛡️', '🍀', '🌀', '🌊'];

const getTeamEmoji = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_EMOJIS[Math.abs(hash) % TEAM_EMOJIS.length];
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

interface EditableMember {
  id: string;
  firstName: string;
  lastName: string;
  isNew?: boolean;
}

export const TeamsPage = () => {
  const location = useLocation();
  const tournamentId = location.pathname.split('/')[2];
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();

  const [tournamentName, setTournamentName] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    coach: '',
  });

  // Состояние модального окна редактирования команды
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    organization: '',
    coach: '',
  });
  const [editMembers, setEditMembers] = useState<EditableMember[]>([]);
  const [removedMemberIds, setRemovedMemberIds] = useState<string[]>([]);
  const [selectedFreeParticipantId, setSelectedFreeParticipantId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = async () => {
    if (!tournamentId) return;
    try {
      const [tourneyRes, teamsRes, partsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tournaments/${tournamentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/tournaments/${tournamentId}/teams`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/tournaments/${tournamentId}/participants`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (tourneyRes.ok) {
        const tourney = await tourneyRes.json();
        setTournamentName(tourney.name || '');
      }
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (partsRes.ok) setParticipants(await partsRes.json());
    } catch (err: any) {
      showError('Ошибка загрузки данных', { message: err.message });
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        organization: formData.organization,
        city: '',
        coach: formData.coach,
        seed: 0,
      };

      const res = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Ошибка создания команды', data);
        return;
      }

      showSuccess('Команда успешно создана!');
      setIsModalOpen(false);
      setFormData({ name: '', organization: '', coach: '' });
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети', { message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (team: any) => {
    const currentMembers = participants
      .filter((p) => p.teamId === team.id)
      .map((p) => ({
        id: p.id,
        firstName: p.firstName || '',
        lastName: p.lastName || '',
      }));

    setEditingTeam(team);
    setEditForm({
      name: team.name || '',
      organization: team.organization || '',
      coach: team.coach || '',
    });
    setEditMembers(currentMembers);
    setRemovedMemberIds([]);
    setSelectedFreeParticipantId('');
  };

  const handleAddFreeMemberToEdit = () => {
    if (!selectedFreeParticipantId) return;
    const found = participants.find((p) => p.id === selectedFreeParticipantId);
    if (!found) return;

    setEditMembers((prev) => [
      ...prev,
      {
        id: found.id,
        firstName: found.firstName || '',
        lastName: found.lastName || '',
        isNew: true,
      },
    ]);
    setRemovedMemberIds((prev) => prev.filter((id) => id !== found.id));
    setSelectedFreeParticipantId('');
  };

  const handleRemoveMemberFromEdit = (member: EditableMember) => {
    setEditMembers((prev) => prev.filter((m) => m.id !== member.id));
    if (!member.isNew) {
      setRemovedMemberIds((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    if (!editForm.name.trim()) {
      showError('Введите название команды');
      return;
    }

    setSavingEdit(true);
    try {
      const addMemberIds = editMembers.filter((m) => m.isNew).map((m) => m.id);
      const res = await fetch(`${API_BASE}/api/tournaments/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          organization: editForm.organization.trim(),
          coach: editForm.coach.trim(),
          members: editMembers.map((m) => ({
            id: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          })),
          addMemberIds,
          removeMemberIds: removedMemberIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Ошибка обновления команды', data);
        return;
      }

      showSuccess('Изменения сохранены');
      setEditingTeam(null);
      fetchData();
    } catch (err: any) {
      showError('Ошибка сети при сохранении', { message: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Удалить эту команду?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/tournaments/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Команда удалена');
        fetchData();
      }
    } catch (err: any) {
      showError('Ошибка удаления', { message: err.message });
    }
  };

  const filteredTeams = teams.filter(t =>
    `${t.name} ${t.organization} ${t.coach}`.toLowerCase().includes(search.toLowerCase())
  );

  const freeParticipants = participants.filter(
    (p) => !p.teamId && !editMembers.some((m) => m.id === p.id)
  );

  const handlePrintPDF = () => {
    const listToExport = search.trim() ? filteredTeams : teams;
    const totalMembers = listToExport.reduce(
      (acc, t) => acc + participants.filter(p => p.teamId === t.id).length,
      0
    );
    const formattedDate = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const rowsHtml = listToExport.length === 0
      ? `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #64748b;">Список команд пуст</td></tr>`
      : listToExport.map((t, idx) => {
          const members = participants.filter(p => p.teamId === t.id);
          const membersHtml = members.length === 0
            ? '<span style="color: #94a3b8;">—</span>'
            : members
                .map((m, i) => `<div><span style="color:#64748b;">${i + 1}.</span> ${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</div>`)
                .join('');

          return `
            <tr class="${idx % 2 === 1 ? 'alt' : ''}">
              <td class="num">${idx + 1}</td>
              <td class="team">${escapeHtml(t.name)}</td>
              <td>${t.organization ? escapeHtml(t.organization) : '<span style="color:#94a3b8;">—</span>'}</td>
              <td>${t.coach ? escapeHtml(t.coach) : '<span style="color:#94a3b8;">—</span>'}</td>
              <td class="members">${membersHtml}</td>
            </tr>
          `;
        }).join('');

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(tournamentName || 'Список команд')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      font-size: 9.5pt;
      line-height: 1.35;
    }
    .page-frame {
      width: 100%;
      border-collapse: collapse;
    }
    .page-margin-top {
      height: 11mm;
    }
    .page-margin-bottom {
      height: 11mm;
    }
    .page-body {
      padding: 0 13mm;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 7px;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #0f172a;
    }
    .doc-title {
      margin: 0;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #0f172a;
    }
    .doc-subtitle {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      color: #64748b;
    }
    .doc-stats {
      display: flex;
      gap: 8px;
      font-size: 8.5pt;
      font-weight: 600;
      color: #334155;
    }
    .stat-pill {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 3px 8px;
      white-space: nowrap;
    }
    table.teams {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    table.teams thead {
      display: table-header-group;
    }
    table.teams th {
      background: #f1f5f9;
      color: #1e293b;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #cbd5e1;
      border-right: 1px solid #e2e8f0;
    }
    table.teams th:last-child,
    table.teams td:last-child {
      border-right: none;
    }
    table.teams tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table.teams tr.alt td {
      background: #f8fafc;
    }
    table.teams td {
      padding: 5px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      vertical-align: top;
      color: #334155;
    }
    table.teams tbody tr:last-child td {
      border-bottom: none;
    }
    td.num, th.num {
      width: 28px;
      text-align: center;
      color: #64748b;
      font-weight: 600;
    }
    td.team {
      font-weight: 600;
      color: #0f172a;
      width: 23%;
    }
    td.members {
      width: 31%;
      color: #0f172a;
    }
    td.members div + div {
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <table class="page-frame">
    <thead><tr><td class="page-margin-top"></td></tr></thead>
    <tbody>
      <tr>
        <td class="page-body">
          <div class="doc-header">
            <div>
              <h1 class="doc-title">${escapeHtml(tournamentName || 'Список команд')}</h1>
              <p class="doc-subtitle">Реестр команд турнира • ${formattedDate}</p>
            </div>
            <div class="doc-stats">
              <span class="stat-pill">Команд: ${listToExport.length}</span>
              <span class="stat-pill">Участников: ${totalMembers}</span>
            </div>
          </div>

          <table class="teams">
            <thead>
              <tr>
                <th class="num">№</th>
                <th>Команда</th>
                <th>Организация</th>
                <th>Тренер</th>
                <th>Состав</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
    <tfoot><tr><td class="page-margin-bottom"></td></tr></tfoot>
  </table>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 150);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Верхняя панель управления */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Команды турнира</h2>
          <p className="text-sm text-slate-500">Всего зарегистрировано команд: {teams.length}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm cursor-pointer"
          >
            <Printer size={16} /> Скачать PDF
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-rhetora-teal hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm cursor-pointer"
          >
            <Plus size={18} /> Добавить команду
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск команд..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
      </div>

      {/* Основная таблица на экране */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Название команды</th>
              <th className="p-4 font-semibold">Организация</th>
              <th className="p-4 font-semibold">Тренер / Куратор</th>
              <th className="p-4 font-semibold">Участники</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredTeams.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Команды пока не добавлены.
                </td>
              </tr>
            ) : (
              filteredTeams.map(t => {
                const teamMembers = participants.filter(p => p.teamId === t.id);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="inline-flex items-center gap-2.5 text-left hover:text-rhetora-teal transition cursor-pointer"
                      >
                        <span className="text-base select-none">{getTeamEmoji(t.name)}</span>
                        <span>{t.name}</span>
                      </button>
                    </td>
                    <td className="p-4 text-slate-600">{t.organization || '—'}</td>
                    <td className="p-4 text-slate-600">{t.coach || '—'}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelectedTeam(t)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-full border border-sky-200 transition cursor-pointer"
                      >
                        <Users size={14} />
                        {teamMembers.length} участников
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          title="Изменить команду"
                          className="p-1.5 text-slate-400 hover:text-rhetora-teal hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          title="Удалить команду"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно состава команды */}
      {selectedTeam && (
        <div
          onClick={() => setSelectedTeam(null)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden"
          >
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getTeamEmoji(selectedTeam.name)}</span>
                <h3 className="font-bold text-lg text-slate-900">Состав команды: {selectedTeam.name}</h3>
              </div>
              <button onClick={() => setSelectedTeam(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {participants.filter(p => p.teamId === selectedTeam.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">В этой команде пока нет участников.</p>
              ) : (
                participants
                  .filter(p => p.teamId === selectedTeam.id)
                  .map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                      <span className="font-semibold text-slate-900">{p.firstName} {p.lastName}</span>
                      <span className="text-xs text-slate-500">{p.organization || selectedTeam.organization || '—'}</span>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const teamToEdit = selectedTeam;
                  setSelectedTeam(null);
                  openEditModal(teamToEdit);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-xl text-sm transition cursor-pointer"
              >
                <Pencil size={14} /> Изменить состав и данные
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl text-sm transition cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования команды */}
      {editingTeam && (
        <div
          onClick={() => !savingEdit && setEditingTeam(null)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg border overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-5 border-b bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getTeamEmoji(editForm.name || editingTeam.name)}</span>
                <h3 className="font-bold text-lg text-slate-900">Редактировать команду</h3>
              </div>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingTeam(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Название команды *</label>
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Организация</label>
                  <input
                    placeholder="Школа / клуб"
                    value={editForm.organization}
                    onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Тренер / Куратор</label>
                  <input
                    placeholder="ФИО тренера"
                    value={editForm.coach}
                    onChange={(e) => setEditForm({ ...editForm, coach: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal focus:bg-white"
                  />
                </div>
              </div>

              {/* Редактирование участников команды */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Состав участников ({editMembers.length})
                  </label>
                </div>

                {editMembers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">В команде нет участников.</p>
                ) : (
                  <div className="space-y-2">
                    {editMembers.map((member, idx) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          placeholder="Имя"
                          value={member.firstName}
                          onChange={(e) =>
                            setEditMembers((prev) =>
                              prev.map((m) => (m.id === member.id ? { ...m, firstName: e.target.value } : m))
                            )
                          }
                          className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rhetora-teal focus:bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Фамилия"
                          value={member.lastName}
                          onChange={(e) =>
                            setEditMembers((prev) =>
                              prev.map((m) => (m.id === member.id ? { ...m, lastName: e.target.value } : m))
                            )
                          }
                          className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rhetora-teal focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromEdit(member)}
                          title="Убрать из команды"
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0 cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {freeParticipants.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={selectedFreeParticipantId}
                      onChange={(e) => setSelectedFreeParticipantId(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-rhetora-teal"
                    >
                      <option value="">+ Добавить свободного участника...</option>
                      {freeParticipants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.organization ? `(${p.organization})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedFreeParticipantId}
                      onClick={handleAddFreeMemberToEdit}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold transition disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      <UserPlus size={14} /> Добавить
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-rhetora-teal text-white font-medium rounded-xl text-sm hover:bg-sky-600 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания команды */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-lg text-slate-900">Создание команды</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Название команды *</label>
                <input
                  required
                  placeholder="Напр. Alpha"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Организация</label>
                <input
                  placeholder="Напр. Клуб дебатов Эсил"
                  value={formData.organization}
                  onChange={e => setFormData({...formData, organization: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Тренер / Куратор</label>
                <input
                  placeholder="Имя тренера"
                  value={formData.coach}
                  onChange={e => setFormData({...formData, coach: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-rhetora-teal"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rhetora-teal text-white font-medium rounded-xl text-sm hover:bg-sky-600 transition cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
