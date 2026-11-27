'use client';

import { Banknote, CheckCircle2, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { RevenueChart } from '@/components/Charts';
import { Card, Empty, Loader, money, StatusBadge, Toast, dateTime } from '@/components/ui';
import { api, post } from '@/lib/api';
import type { PaymentRecord } from '@/lib/types';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [revenue, setRevenue] = useState<{ byDay: Record<string, number>; total: number; count: number }>({ byDay: {}, total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentData, revenueData] = await Promise.all([
        api<PaymentRecord[]>('/payments'),
        api<{ byDay: Record<string, number>; total: number; count: number }>('/reports/revenue'),
      ]);
      setPayments(paymentData);
      setRevenue(revenueData);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load payments', true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function verify(id: string) {
    try {
      await post(`/payments/${id}/verify`, { status: 'COMPLETED' });
      notify('Payment verified');
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Verification failed', true);
    }
  }

  async function refund(id: string) {
    const reason = window.prompt('Reason for refund');
    if (!reason) return;
    try {
      await post(`/payments/${id}/refund`, { reason });
      notify('Payment refunded');
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Refund failed', true);
    }
  }

  const completed = payments.filter((payment) => payment.status === 'COMPLETED').length;
  const pending = payments.filter((payment) => payment.status === 'PENDING').length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Finance</div>
          <h1 className="title">Payments</h1>
          <p className="subtitle">Verify collections, handle refunds and monitor revenue.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <Card title="Collected" subtitle="Completed payments"><div className="stat-value" style={{ color: 'var(--green)' }}>{money(revenue.total)}</div></Card>
        <Card title="Transactions" subtitle="Completed count"><div className="stat-value">{revenue.count}</div></Card>
        <Card title="Awaiting verification" subtitle="Pending records"><div className="stat-value" style={{ color: 'var(--amber)' }}>{pending}</div></Card>
      </div>

      <div style={{ marginBottom: 18 }}>
        <Card title="Revenue by day" subtitle="Completed collections">
          <RevenueChart byDay={revenue.byDay} />
        </Card>
      </div>

      <Card title="Payment ledger" subtitle={`${payments.length} recent records · ${completed} completed`} bodyClassName="table-wrap">
        {loading ? (
          <Loader />
        ) : payments.length === 0 ? (
          <Empty title="No payments recorded" message="Payment activity appears here." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th className="cell-right">Amount</th>
                <th className="cell-right">Date</th>
                <th className="cell-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="cell-strong">{payment.order.bookingCode}</td>
                  <td>{payment.order.customer.user.firstName} {payment.order.customer.user.lastName ?? ''}</td>
                  <td><StatusBadge status={payment.method} /></td>
                  <td className="cell-muted">{payment.transactionReference ?? '—'}</td>
                  <td><StatusBadge status={payment.status} /></td>
                  <td className="cell-right cell-strong">{money(payment.amount, payment.currency)}</td>
                  <td className="cell-right cell-muted">{dateTime(payment.paidAt ?? payment.createdAt)}</td>
                  <td className="cell-right">
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {payment.status === 'PENDING' ? (
                        <button className="btn btn-primary btn-sm" onClick={() => void verify(payment.id)}>
                          <CheckCircle2 size={14} /> Verify
                        </button>
                      ) : null}
                      {payment.status === 'COMPLETED' ? (
                        <button className="btn btn-danger btn-sm" onClick={() => void refund(payment.id)}>
                          <RotateCcw size={14} /> Refund
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
