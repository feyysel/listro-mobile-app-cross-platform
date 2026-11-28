'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { OrderDrawer } from '@/components/OrderDrawer';
import { Card, dateTime, Empty, Loader, money, StatusBadge, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { useLiveRefresh } from '@/lib/realtime';
import type { OrderSummary, Page as PageType } from '@/lib/types';

export default function HistoryPage() {
  const [data, setData] = useState<PageType<OrderSummary> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) setSearch(searchParam);
  }, []);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status: 'DELIVERED',
      includePayments: 'true',
      page: String(page),
      limit: '20',
    });
    if (search) params.set('search', search);
    try {
      setData(await api<PageType<OrderSummary>>(`/orders?${params.toString()}`));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load history', true);
    } finally {
      setLoading(false);
    }
  }, [page, search, notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useLiveRefresh(refresh);

  const paidAmount = (order: OrderSummary) =>
    (order.payments ?? [])
      .filter((payment) => payment.status === 'COMPLETED')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Archive</div>
          <h1 className="title">Order history</h1>
          <p className="subtitle">Delivered orders with their payment records.</p>
        </div>
        <div className="header-actions">
          <span className="badge blue">{data?.meta.total ?? 0} completed orders</span>
        </div>
      </div>

      <div className="filters">
        <div className="search" style={{ width: 320 }}>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Booking code or customer"
          />
        </div>
      </div>

      <Card title="Completed orders" subtitle="Click a row to view the full order and payment history" bodyClassName="table-wrap">
        {loading && !data ? (
          <Loader />
        ) : !data || data.items.length === 0 ? (
          <Empty title="No completed orders" message="Delivered orders will appear here with their payments." />
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Payments</th>
                  <th className="cell-right">Paid</th>
                  <th className="cell-right">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => {
                  const completed = (order.payments ?? []).filter((payment) => payment.status === 'COMPLETED');
                  return (
                    <tr key={order.id} onClick={() => setDrawerId(order.id)} style={{ cursor: 'pointer' }}>
                      <td className="cell-strong">{order.bookingCode}</td>
                      <td>
                        <div className="cell-strong">{order.customer.user.firstName} {order.customer.user.lastName ?? ''}</div>
                        <div className="cell-muted">{order.customer.user.email}</div>
                      </td>
                      <td>{order._count.items}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="cell-muted">
                        {completed.length}/{order.payments?.length ?? 0} cleared
                      </td>
                      <td className="cell-right cell-strong">{money(paidAmount(order), order.currency)}</td>
                      <td className="cell-right cell-muted">{dateTime(order.completedAt ?? order.placedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderTop: '1px solid var(--line)' }}>
              <span className="cell-muted">
                Page {data.meta.page} of {Math.max(data.meta.pages, 1)} · {data.meta.total} orders
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft size={15} /> Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= data.meta.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <OrderDrawer
        orderId={drawerId}
        onClose={() => setDrawerId(null)}
        onChanged={() => void refresh()}
        notify={notify}
      />
      {toast ? <Toast {...toast} /> : null}
    </>
  );
}
