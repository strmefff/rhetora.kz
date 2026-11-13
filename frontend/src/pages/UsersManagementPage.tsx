import { API_BASE } from "../config/api";
import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, UserCheck, Trash2, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const UsersManagementPage = () => {
  const { token } = useAuth();
  const { showError, showSuccess } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch (err: any) {
      showError('Ошибка загрузки пользователей', { message: err.message });
    }
  };

  useEffect(() => { fetchUsers(); }, [token]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showSuccess('Роль успешно обновлена');
        fetchUsers();
      }
    } catch (err: any) {
      showError('Ошибка при смене роли', { message: err.message });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот аккаунт?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showSuccess('Аккаунт удален');
        fetchUsers();
      }
    } catch (err: any) {
      showError('Ошибка удаления аккаунта', { message: err.message });
    }
  };

  const filteredUsers = users.filter(u =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Управление аккаунтами</h1>
          <p className="text-sm text-slate-500">Панель Суперадмина: распределение ролей и прав доступа</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск пользователей по имени, email или роли..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rhetora-teal/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Пользователь</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Текущая роль</th>
              <th className="p-4 font-semibold">Дата регистрации</th>
              <th className="p-4 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition">
                <td className="p-4 font-medium text-slate-900">{u.name}</td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="SUPERADMIN">Суперадмин</option>
                    <option value="ORGANIZER">Организатор</option>
                    <option value="JUDGE">Судья</option>
                  </select>
                </td>
                <td className="p-4 text-slate-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
