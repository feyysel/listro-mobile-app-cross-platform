'use client';

import { CheckCircle2, Droplets, Play, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Loader, StatusBadge, Toast, dateTime } from '@/components/ui';
import { api, patch, post } from '@/lib/api';
import { useLiveRefresh } from '@/lib/realtime';
import { useStoredUser } from '@/lib/session';
import type { Role, SessionUser, WashingTask } from '@/lib/types';

const tabs = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

export default function WashingPage() {
  const [tasks, setTasks] = useState<WashingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const user = useStoredUser<SessionUser>();
  const role = user?.role as Role | undefined;
  const isManager = role === 'MANAGER' || role === 'ADMIN';

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const path = isManager ? '/washing-tasks/center' : '/washing-tasks/my';
      const result = await api<WashingTask[]>(path);
      setTasks(result);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load cleaning tasks', true);
    } finally {
      setLoading(false);
    }
  }, [isManager, notify]);

  useEffect(() => {
    void refresh();
    if (isManager) {
      api<{ items: Array<{ id: string; user: { firstName: string; lastName: string | null } }> }>(
        '/employees?role=OPERATOR&limit=100',
      )
        .then((result) =>
          setOperators(
            result.items.map((employee) => ({
              id: employee.id,
              name: `${employee.user.firstName} ${employee.user.lastName ?? ''}`.trim(),
            })),
          ),
        )
        .catch(() => setOperators([]));
    }
  }, [refresh, isManager]);

  useLiveRefresh(refresh);

  async function update(taskId: string, nextStatus: string, message: string) {
    try {
      await patch(`/washing-tasks/${taskId}/status`, { status: nextStatus });
      notify(message);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Update failed', true);
    }
  }

  async function assign(taskId: string) {
    const operatorId = assignments[taskId];
    if (!operatorId) return;
    try {
      await post(`/washing-tasks/${taskId}/assign`, { operatorId });
      notify('Task assigned');
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Assignment failed', true);
    }
  }

  const visible = status === 'ALL' ? tasks : tasks.filter((task) => task.status === status);
  const completed = tasks.filter((task) => task.status === 'COMPLETED').length;
  const active = tasks.filter((task) => task.status === 'IN_PROGRESS').length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Cleaning floor</div>
          <h1 className="title">Washing bench</h1>
          <p className="subtitle">Assign, start and finish shoe care tasks with a complete audit trail.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <Card title="Queued" subtitle="Waiting for an operator">
          <div className="stat-value">{tasks.filter((task) => task.status === 'PENDING').length}</div>
        </Card>
        <Card title="In progress" subtitle="Currently on the bench">
          <div className="stat-value" style={{ color: 'var(--brand)' }}>{active}</div>
        </Card>
        <Card title="Completed" subtitle="Ready for quality check">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{completed}</div>
        </Card>
      </div>

      <div className="filters">
        <div className="tabs">
          {tabs.map((tab) => (
            <button key={tab} className={`tab${status === tab ? ' active' : ''}`} onClick={() => setStatus(tab)}>
              {tab === 'ALL' ? 'All tasks' : tab.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <Card title="Cleaning queue" subtitle={isManager ? 'All tasks in your branch scope' : 'Tasks assigned to you'} bodyClassName="table-wrap">
        {loading ? (
          <Loader />
        ) : visible.length === 0 ? (
          <Empty title="Queue is clear" message="No cleaning tasks match this filter." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Shoe</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Status</th>
                <th className="cell-right">Created</th>
                <th className="cell-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr key={task.id}>
                  <td className="cell-strong">{task.order.bookingCode}</td>
                  <td>
                    <div className="cell-strong">{task.orderItem.serviceName}</div>
                    <div className="cell-muted">{task.orderItem.shoeBrand ?? 'Unbranded'} · {task.orderItem.shoeCategory}</div>
                  </td>
                  <td>{task.order.customer?.user ? `${task.order.customer.user.firstName} ${task.order.customer.user.lastName ?? ''}`.trim() : '—'}</td>
                  <td className="cell-muted">
                    {task.operator?.user ? `${task.operator.user.firstName} ${task.operator.user.lastName ?? ''}`.trim() : 'Unassigned'}
                  </td>
                  <td><StatusBadge status={task.status} /></td>
                  <td className="cell-right cell-muted">{dateTime(task.createdAt)}</td>
                  <td className="cell-right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {isManager && !task.operator ? (
                        <>
                          <select
                            className="filter-input"
                            style={{ minWidth: 140, padding: '7px 9px' }}
                            value={assignments[task.id] ?? ''}
                            onChange={(event) => setAssignments((current) => ({ ...current, [task.id]: event.target.value }))}
                          >
                            <option value="">Operator</option>
                            {operators.map((operator) => (
                              <option key={operator.id} value={operator.id}>{operator.name}</option>
                            ))}
                          </select>
                          <button className="btn btn-secondary btn-sm" disabled={!assignments[task.id]} onClick={() => void assign(task.id)}>
                            Assign
                          </button>
                        </>
                      ) : null}
                      {['PENDING', 'ASSIGNED'].includes(task.status) ? (
                        <button className="btn btn-primary btn-sm" onClick={() => void update(task.id, 'IN_PROGRESS', 'Task started')}>
                          <Play size={14} /> Start
                        </button>
                      ) : null}
                      {task.status === 'IN_PROGRESS' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => void update(task.id, 'COMPLETED', 'Task completed')}>
                          <CheckCircle2 size={14} /> Finish
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {toast ? <Toast {...toast} /> : null}
    </>
  );
}
