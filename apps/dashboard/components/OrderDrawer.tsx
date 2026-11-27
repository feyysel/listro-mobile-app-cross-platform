'use client';

import { Check, CircleCheck, Clock3, Package, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, getStoredUser, patch, post } from '@/lib/api';
import type { OrderDetail, Role, SessionUser } from '@/lib/types';
import { Card, dateTime, Empty, money, StatusBadge } from './ui';

interface Employee {
  id: string;
  role: string;
  name: string;
}

export function OrderDrawer({
  orderId,
  onClose,
  onChanged,
  notify,
}: {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [busy, setBusy] = useState(false);
  const user = getStoredUser<SessionUser>();
  const role = user?.role as Role | undefined;
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const isOperator = role === 'OPERATOR' || isManager;

  useEffect(() => {
    setSelectedDriver('');
    if (!orderId) return;
    api<OrderDetail>(`/orders/${orderId}`).then(setOrder).catch((error) => notify(error.message, true));
    if (isManager) {
      api<{
        items: Array<{
          id: string;
          role?: string;
          user: { firstName: string; lastName: string | null; role?: string };
        }>;
      }>('/employees?role=DELIVERY&limit=100')
        .then((result) =>
          setEmployees(
            result.items.map((employee) => ({
              id: employee.id,
              role: employee.user.role ?? employee.role ?? '',
              name: `${employee.user.firstName} ${employee.user.lastName ?? ''}`.trim(),
            })),
          ),
        )
        .catch(() => setEmployees([]));
    }
  }, [orderId, isManager, notify]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      notify(message);
      if (orderId) setOrder(await api<OrderDetail>(`/orders/${orderId}`));
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Action failed', true);
    } finally {
      setBusy(false);
    }
  }

  if (!orderId) return null;

  const customerName = order
    ? `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim()
    : '';
  const driverEmployees = employees.filter((employee) => employee.role === 'DELIVERY');
  const pickupDelivery = order?.deliveries.find((delivery) => delivery.type === 'PICKUP');
  const pendingPayment = order?.payments.find((payment) => payment.status === 'PENDING');

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Order details">
        <div className="drawer-header">
          <div>
            <div className="eyebrow">Order workspace</div>
            <h2 className="title" style={{ fontSize: 24 }}>{order?.bookingCode ?? 'Loading…'}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {order ? <StatusBadge status={order.status} /> : null}
              {order ? <span className="cell-muted">{dateTime(order.placedAt)}</span> : null}
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="drawer-body">
          {!order ? (
            <div className="loader"><div><div className="spinner" />Fetching order…</div></div>
          ) : (
            <>
              <div className="drawer-section">
                <h4>Customer & destination</h4>
                <div className="detail-grid">
                  <div className="detail-box"><span>Customer</span><strong>{customerName}</strong></div>
                  <div className="detail-box"><span>Phone</span><strong>{order.customer.user.phone ?? '—'}</strong></div>
                  <div className="detail-box"><span>Branch</span><strong>{order.branch?.name ?? 'Unassigned'}</strong></div>
                  <div className="detail-box"><span>Total</span><strong>{money(order.totalAmount, order.currency)}</strong></div>
                </div>
              </div>

              <div className="drawer-section">
                <h4>Items</h4>
                {order.items.map((item) => (
                  <div className="detail-box" key={item.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>{item.serviceName}</strong>
                      <span>{money(item.totalPrice, order.currency)}</span>
                    </div>
                    <div className="cell-muted" style={{ marginTop: 5 }}>
                      {item.shoeBrand ?? 'Unbranded'} · {item.shoeCategory} · Qty {item.quantity}
                    </div>
                    {item.washingTask ? (
                      <div style={{ marginTop: 8 }}>
                        <StatusBadge status={item.washingTask.status} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="drawer-section">
                <h4>Workflow history</h4>
                <div className="timeline">
                  {order.statusHistory.map((entry) => (
                    <div className="timeline-item" key={entry.id}>
                      <strong>{entry.newStatus.replaceAll('_', ' ')}</strong>
                      <span>{dateTime(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-section">
                <h4>Actions</h4>
                <div className="drawer-actions">
                  {isManager && order.status === 'PLACED' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => run(() => post(`/orders/${order.id}/confirm`, {}), 'Order confirmed')}
                    >
                      <Check size={15} /> Confirm order
                    </button>
                  ) : null}
                  {isManager && ['PLACED', 'CONFIRMED'].includes(order.status) ? (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection');
                        if (reason) run(() => post(`/orders/${order.id}/reject`, { reason }), 'Order rejected');
                      }}
                    >
                      <X size={15} /> Reject
                    </button>
                  ) : null}
                  {['PLACED', 'CONFIRMED'].includes(order.status) ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt('Reason for cancellation (optional)') ?? '';
                        run(() => post(`/orders/${order.id}/cancel`, reason ? { reason } : {}), 'Order cancelled');
                      }}
                    >
                      Cancel order
                    </button>
                  ) : null}
                  {isManager && ['CONFIRMED', 'DELIVERY_ASSIGNED'].includes(order.status) && !pickupDelivery ? (
                    <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 6 }}>
                      <select
                        className="filter-input"
                        value={selectedDriver}
                        onChange={(event) => setSelectedDriver(event.target.value)}
                      >
                        <option value="">Select delivery person</option>
                        {driverEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!selectedDriver || busy}
                        onClick={() =>
                          run(
                            () => post(`/orders/${order.id}/deliveries/pickup`, { employeeId: selectedDriver }),
                            'Pickup assigned',
                          )
                        }
                      >
                        Assign pickup
                      </button>
                    </div>
                  ) : null}
                  {isOperator && order.items.find((item) => item.washingTask?.status === 'IN_PROGRESS') ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        const task = order.items.find((item) => item.washingTask?.status === 'IN_PROGRESS');
                        if (task?.washingTask) {
                          run(
                            () => patch(`/washing-tasks/${task.washingTask!.id}/status`, { status: 'COMPLETED' }),
                            'Cleaning task completed',
                          );
                        }
                      }}
                    >
                      <CircleCheck size={15} /> Complete cleaning
                    </button>
                  ) : null}
                  {isOperator && order.status === 'WASHING_COMPLETED' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => run(() => post(`/orders/${order.id}/ready`), 'Order marked ready')}
                    >
                      <Package size={15} /> Mark ready
                    </button>
                  ) : null}
                  {isManager && pendingPayment ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => post(`/payments/${pendingPayment.id}/verify`, { status: 'COMPLETED' }),
                          'Payment verified',
                        )
                      }
                    >
                      <Clock3 size={15} /> Verify payment
                    </button>
                  ) : null}
                  {!isManager && !isOperator && order.status === 'PLACED' ? (
                    <span className="cell-muted">Waiting for manager confirmation.</span>
                  ) : null}
                </div>
              </div>

              <Card title="Payments" subtitle="Server-authoritative payment records">
                {order.payments.length === 0 ? (
                  <Empty title="No payments yet" message="Payment records appear here once captured." />
                ) : (
                  order.payments.map((payment) => (
                    <div className="detail-box" key={payment.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{money(payment.amount, order.currency)}</strong>
                        <StatusBadge status={payment.status} />
                      </div>
                      <div className="cell-muted" style={{ marginTop: 5 }}>
                        {payment.method.replaceAll('_', ' ')} · {dateTime(payment.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
