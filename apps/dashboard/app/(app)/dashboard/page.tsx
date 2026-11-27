'use client';

import {
  ArrowUpRight,
  Banknote,
  CircleCheck,
  Clock3,
  Droplets,
  Package,
  Sparkles,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { OrderDrawer } from '@/components/OrderDrawer';
import { MiniBars, RevenueChart, StatusDonut } from '@/components/Charts';
import { Card, dateTime, Empty, Loader, money, StatusBadge, StatCard, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import type { DashboardMetrics, OrderSummary, Page as PageType } from '@/lib/types';

type RevenueData = { byDay: Record<string, number>; total: number; count: number };
type ServiceDatum = { name: string; orders: number; revenue: number };

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [revenue, setRevenue] = useState<RevenueData>({ byDay: {}, total: 0, count: 0 });
  const [services, setServices] = useState<ServiceDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricData, orderData, revenueData, serviceData] = await Promise.all([
        api<DashboardMetrics>('/reports/dashboard'),
        api<PageType<OrderSummary>>('/orders?limit=6').catch(() => ({
          items: [],
          meta: { page: 1, limit: 6, total: 0, pages: 0 },
        })),
        api<RevenueData>('/reports/revenue').catch(() => ({ byDay: {}, total: 0, count: 0 })),
        api<ServiceDatum[]>('/reports/services').catch(() => []),
      ]);
      setMetrics(metricData);
      setOrders(orderData.items);
      setRevenue(revenueData);
      setServices(serviceData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load dashboard';
      setError(message);
      notify(message, true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeOrders = metrics
    ? Object.entries(metrics.orderCounts)
        .filter(([status]) => !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(status))
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  if (loading) return <Loader label="Preparing your workspace…" />;

  if (!metrics) {
    return (
      <div className="page-header">
        <div>
          <div className="eyebrow">Operations overview</div>
          <h1 className="title">Overview unavailable</h1>
          <p className="subtitle">{error ?? 'Unable to load dashboard data.'}</p>
          <button className="btn btn-primary" onClick={() => void refresh()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Operations overview</div>
          <h1 className="title">Good work starts with a clear view.</h1>
          <p className="subtitle">
            Live status across orders, cleaning benches, pickups and revenue.
          </p>
        </div>
        <div className="header-actions">
          <Link className="btn btn-secondary" href="/orders">View all orders</Link>
          <Link className="btn btn-primary" href="/reports">
            Reports <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Active orders"
          value={activeOrders}
          hint={`${metrics.todayOrders} placed today`}
          icon={<Package size={20} />}
        />
        <StatCard
          label="Collected revenue"
          value={money(metrics.collectedRevenue)}
          hint={`${metrics.completedPayments} completed payments`}
          icon={<Banknote size={20} />}
          tone="teal"
        />
        <StatCard
          label="Cleaning in progress"
          value={metrics.washingCounts.WASHING_IN_PROGRESS ?? 0}
          hint={`${metrics.overdueTasks} tasks older than 48h`}
          icon={<Droplets size={20} />}
          tone="amber"
        />
        <StatCard
          label="Pickups in motion"
          value={metrics.activePickups + metrics.activeReturns}
          hint={`${metrics.failedDeliveries} failed deliveries`}
          icon={<Truck size={20} />}
          tone="rose"
        />
      </div>

      <div className="grid two" style={{ marginBottom: 18 }}>
        <Card
          title="Revenue trend"
          subtitle="Completed payments by day"
          action={<span className="badge green">{money(revenue.total)} total</span>}
        >
          <RevenueChart byDay={revenue.byDay} />
        </Card>
        <Card title="Order mix" subtitle="Current order status distribution">
          <StatusDonut counts={metrics.orderCounts} />
        </Card>
      </div>

      <div className="grid two">
        <Card
          title="Recent orders"
          subtitle="Latest activity across your branch"
          action={<Link className="link-button" href="/orders">Open orders →</Link>}
          bodyClassName="table-wrap"
        >
          {orders.length === 0 ? (
            <Empty title="No orders yet" message="New customer orders will appear here." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="cell-right">Total</th>
                  <th className="cell-right">Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} onClick={() => setDrawerId(order.id)} style={{ cursor: 'pointer' }}>
                    <td className="cell-strong">{order.bookingCode}</td>
                    <td>
                      <div className="cell-strong">{order.customer.user.firstName} {order.customer.user.lastName ?? ''}</div>
                      <div className="cell-muted">{order._count.items} item(s)</div>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="cell-right cell-strong">{money(order.totalAmount, order.currency)}</td>
                    <td className="cell-right cell-muted">{dateTime(order.placedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Service demand" subtitle="Most requested services">
            {services.length === 0 ? (
              <Empty title="No service data" message="Service demand appears after the first orders." />
            ) : (
              services.slice(0, 5).map((service) => (
                <div className="progress-row" key={service.name}>
                  <div className="progress-meta">
                    <strong>{service.name}</strong>
                    <span className="cell-muted">{service.orders} orders</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${(service.orders / Math.max(services[0].orders, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card title="Cleaning throughput" subtitle="Bench activity snapshot">
            <MiniBars
              values={[
                metrics.washingCounts.PENDING ?? 0,
                metrics.washingCounts.ASSIGNED ?? 0,
                metrics.washingCounts.IN_PROGRESS ?? 0,
                metrics.washingCounts.COMPLETED ?? 0,
                metrics.orderCounts.READY_FOR_DELIVERY ?? 0,
              ]}
            />
            <div className="cell-muted" style={{ marginTop: 10, fontSize: 11 }}>
              Pending · Assigned · In progress · Completed · Ready
            </div>
          </Card>

          <Card title="Team rhythm" subtitle="What needs attention now">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="stat-icon teal"><CircleCheck size={19} /></span>
              <div>
                <strong>{metrics.orderCounts.READY_FOR_DELIVERY ?? 0} orders ready</strong>
                <div className="cell-muted">Waiting for return dispatch</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="stat-icon amber"><Clock3 size={19} /></span>
              <div>
                <strong>{metrics.overdueTasks} aging tasks</strong>
                <div className="cell-muted">Review the cleaning queue</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

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
