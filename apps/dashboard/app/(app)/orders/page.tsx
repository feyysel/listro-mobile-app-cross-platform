'use client';

import { Boxes, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { OrderDrawer } from '@/components/OrderDrawer';
import { Card, dateTime, Empty, Loader, money, StatusBadge, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import type { OrderSummary, Page as PageType } from '@/lib/types';

const statusTabs = [
  ['ALL', 'All'],
  ['PLACED', 'Placed'],
  ['CONFIRMED', 'Confirmed'],
  ['DELIVERY_ASSIGNED', 'Assigned'],
  ['PICKUP_IN_PROGRESS', 'Pickup'],
  ['RECEIVED_AT_CENTER', 'Received'],
  ['WASHING_IN_PROGRESS', 'Washing'],
  ['READY_FOR_DELIVERY', 'Ready'],
  ['OUT_FOR_DELIVERY', 'Out'],
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
];

export default function OrdersPage() {
  const [data, setData] = useState<PageType<OrderSummary> | null>(null);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  useEffect(() => {
    const searchParam = new URLSearchParams(window.location.search).get('search');
    if (searchParam) setSearch(searchParam);
  }, []);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    try {
      setData(await api<PageType<OrderSummary>>(`/orders?${params.toString()}`));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load orders', true);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Order control center</div>
          <h1 className="title">Orders</h1>
          <p className="subtitle">Follow every pair from booking to doorstep.</p>
        </div>
        <div className="header-actions">
          <span className="badge blue">{data?.meta.total ?? 0} total orders</span>
        </div>
      </div>

      <div className="filters">
        <div className="tabs">
          {statusTabs.map(([value, label]) => (
            <button
              key={value}
              className={`tab${status === value ? ' active' : ''}`}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search" style={{ width: 280 }}>
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

      <Card title="Order queue" subtitle="Click a row to inspect and act" bodyClassName="table-wrap">
        {loading && !data ? (
          <Loader />
        ) : !data || data.items.length === 0 ? (
          <Empty title="No matching orders" message="Try a different status or search term." />
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Branch</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className="cell-right">Total</th>
                  <th className="cell-right">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id} onClick={() => setDrawerId(order.id)} style={{ cursor: 'pointer' }}>
                    <td className="cell-strong">{order.bookingCode}</td>
                    <td>
                      <div className="cell-strong">{order.customer.user.firstName} {order.customer.user.lastName ?? ''}</div>
                      <div className="cell-muted">{order.customer.user.email}</div>
                    </td>
                    <td className="cell-muted">{order.branch?.code ?? '—'}</td>
                    <td>{order._count.items}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="cell-right cell-strong">{money(order.totalAmount, order.currency)}</td>
                    <td className="cell-right cell-muted">{dateTime(order.placedAt)}</td>
                  </tr>
                ))}
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
