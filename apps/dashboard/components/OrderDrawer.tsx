'use client';

import { Check, CircleCheck, Clock3, Package, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, patch, post } from '@/lib/api';
import { useLiveRefresh } from '@/lib/realtime';
import { useStoredUser } from '@/lib/session';
import type { OrderDetail, Role, SessionUser } from '@/lib/types';
import { Card, dateTime, Empty, money, StatusBadge } from './ui';

interface Employee {
  id: string;
  role: string;
  name: string;
}

interface PaymentRequirements {
  depositRequired: number;
  depositPaid: number;
  depositMissing: number;
  depositComplete: boolean;
  outstanding: number;
  fullyPaid: boolean;
  status: string;
}

interface RatingRecord {
  score: number;
  comment: string | null;
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
  const [requirements, setRequirements] = useState<PaymentRequirements | null>(null);
  const [rating, setRating] = useState<RatingRecord | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedReturnDriver, setSelectedReturnDriver] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const user = useStoredUser<SessionUser>();
  const role = user?.role as Role | undefined;
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const isOperator = role === 'OPERATOR' || isManager;
  const isCustomer = role === 'CUSTOMER';

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const [detail, paymentStatus, existingRating] = await Promise.all([
        api<OrderDetail>(`/orders/${orderId}`),
        api<PaymentRequirements>(`/orders/${orderId}/payment-requirements`),
        api<RatingRecord | null>(`/orders/${orderId}/rating`),
      ]);
      setOrder(detail);
      setRequirements(paymentStatus);
      setRating(existingRating);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load order', true);
    }
  }, [orderId, notify]);

  useEffect(() => {
    setSelectedDriver('');
    setSelectedReturnDriver('');
    void load();
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
  }, [load, isManager]);

  useLiveRefresh(() => void load());

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      notify(message);
      await load();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Action failed', true);
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(kind: 'DEPOSIT' | 'FINAL') {
    if (!order || !requirements) return;
    const suggested = kind === 'DEPOSIT' ? requirements.depositMissing : requirements.outstanding;
    const amount = paymentAmount ? Number(paymentAmount) : suggested;
    if (!amount || amount <= 0) {
      notify('This payment is already satisfied', true);
      return;
    }
    setBusy(true);
    try {
      await post(`/orders/${order.id}/payments`, {
        kind,
        amount,
        method: paymentMethod,
        transactionReference: paymentReference.trim() || undefined,
      });
      setPaymentAmount('');
      setPaymentReference('');
      notify(
        kind === 'DEPOSIT'
          ? 'Deposit submitted for verification'
          : 'Final payment submitted for verification',
      );
      await load();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Payment failed', true);
    } finally {
      setBusy(false);
    }
  }

  async function submitRating() {
    if (!order) return;
    setBusy(true);
    try {
      await post(`/orders/${order.id}/rating`, { score, comment: comment.trim() || null });
      setComment('');
      notify('Thank you for rating the service');
      await load();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Rating failed', true);
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
  const returnDelivery = order?.deliveries.find((delivery) => delivery.type === 'RETURN');
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

              {requirements ? (
                <div className="drawer-section">
                  <h4>Payment status</h4>
                  <div className="detail-grid">
                    <div className="detail-box">
                      <span>50% deposit</span>
                      <strong>
                        {money(requirements.depositPaid, order.currency)} / {money(requirements.depositRequired, order.currency)}
                      </strong>
                    </div>
                    <div className="detail-box">
                      <span>Remaining balance</span>
                      <strong>{money(requirements.outstanding, order.currency)}</strong>
                    </div>
                  </div>
                  {isCustomer && !requirements.depositComplete ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <input
                        className="filter-input"
                        type="number"
                        min={requirements.depositMissing}
                        placeholder={`Deposit ${money(requirements.depositMissing, order.currency)}`}
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                      <select
                        className="filter-input"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="TELEBIRR">Telebirr</option>
                        <option value="CBE_BIRR">CBE Birr</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CARD">Card</option>
                      </select>
                      <input
                        className="filter-input"
                        placeholder="Transaction reference"
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void recordPayment('DEPOSIT')}
                      >
                        Pay deposit
                      </button>
                    </div>
                  ) : null}
                  {isCustomer &&
                  requirements.depositComplete &&
                  !requirements.fullyPaid &&
                  ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <input
                        className="filter-input"
                        type="number"
                        min={requirements.outstanding}
                        placeholder={`Balance ${money(requirements.outstanding, order.currency)}`}
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                      <select
                        className="filter-input"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="TELEBIRR">Telebirr</option>
                        <option value="CBE_BIRR">CBE Birr</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CARD">Card</option>
                      </select>
                      <input
                        className="filter-input"
                        placeholder="Transaction reference"
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void recordPayment('FINAL')}
                      >
                        Pay balance
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

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
                      disabled={busy || !requirements?.depositComplete}
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
                  {isManager && order.status === 'READY_FOR_DELIVERY' && !returnDelivery ? (
                    <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 6 }}>
                      <select
                        className="filter-input"
                        value={selectedReturnDriver}
                        onChange={(event) => setSelectedReturnDriver(event.target.value)}
                      >
                        <option value="">Select return driver</option>
                        {driverEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={!selectedReturnDriver || busy}
                        onClick={() =>
                          run(
                            () =>
                              post(`/orders/${order.id}/deliveries/return`, {
                                employeeId: selectedReturnDriver,
                              }),
                            'Return delivery assigned',
                          )
                        }
                      >
                        Assign return
                      </button>
                    </div>
                  ) : null}
                  {isManager &&
                  returnDelivery &&
                  ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(order.status) ? (
                    <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 6 }}>
                      <select
                        className="filter-input"
                        value={selectedReturnDriver}
                        onChange={(event) => setSelectedReturnDriver(event.target.value)}
                      >
                        <option value="">Reassign return driver</option>
                        {driverEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={!selectedReturnDriver || busy}
                        onClick={() =>
                          run(
                            () =>
                              post(`/deliveries/${returnDelivery.id}/reassign`, {
                                employeeId: selectedReturnDriver,
                                reason: 'Return delivery reassigned by manager',
                              }),
                            'Return delivery reassigned',
                          )
                        }
                      >
                        Reassign return
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

              {isCustomer && order.status === 'DELIVERED' ? (
                <Card title="Rate this service" subtitle="Your feedback helps the team improve">
                  {rating ? (
                    <p className="cell-muted">You rated this order {rating.score}/5.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          className="icon-button"
                          aria-label={`Rate ${value} stars`}
                          onClick={() => setScore(value)}
                        >
                          <Star size={18} fill={value <= score ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                      <input
                        className="filter-input"
                        placeholder="Optional comment"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => void submitRating()}
                      >
                        Submit rating
                      </button>
                    </div>
                  )}
                </Card>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
