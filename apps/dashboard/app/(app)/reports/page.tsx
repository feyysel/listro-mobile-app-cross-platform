'use client';

import { BarChart3, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { RevenueChart, StatusDonut } from '@/components/Charts';
import { Card, Empty, Loader, money, StatusBadge, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import type { DashboardMetrics } from '@/lib/types';

interface WorkloadRow {
  id: string;
  name: string;
  role: string;
  deliveries: number;
  cleaningTasks: number;
}

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenue, setRevenue] = useState<{ byDay: Record<string, number>; total: number; count: number; byMethod: Record<string, number> }>({ byDay: {}, total: 0, count: 0, byMethod: {} });
  const [services, setServices] = useState<Array<{ name: string; orders: number; revenue: number }>>([]);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    Promise.all([
      api<DashboardMetrics>('/reports/dashboard'),
      api<{ byDay: Record<string, number>; total: number; count: number; byMethod: Record<string, number> }>('/reports/revenue'),
      api<Array<{ name: string; orders: number; revenue: number }>>('/reports/services'),
      api<WorkloadRow[]>('/reports/workload'),
    ])
      .then(([metricData, revenueData, serviceData, workloadData]) => {
        setMetrics(metricData);
        setRevenue(revenueData);
        setServices(serviceData);
        setWorkload(workloadData);
      })
      .catch((error) => notify(error instanceof Error ? error.message : 'Unable to load reports', true))
      .finally(() => setLoading(false));
  }, [notify]);

  if (loading || !metrics) return <Loader label="Building reports…" />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Insights</div>
          <h1 className="title">Reports</h1>
          <p className="subtitle">Revenue, demand and team performance in one place.</p>
        </div>
      </div>

      <div className="stat-grid">
        <Card title="Gross collections" subtitle="Completed payments"><div className="stat-value" style={{ color: 'var(--green)' }}>{money(revenue.total)}</div></Card>
        <Card title="Transactions" subtitle="Verified payments"><div className="stat-value">{revenue.count}</div></Card>
        <Card title="Orders delivered" subtitle="Fulfilled successfully"><div className="stat-value">{metrics.orderCounts.DELIVERED ?? 0}</div></Card>
        <Card title="Failed deliveries" subtitle="Needs attention"><div className="stat-value" style={{ color: 'var(--rose)' }}>{metrics.failedDeliveries}</div></Card>
      </div>

      <div className="grid two" style={{ marginBottom: 18 }}>
        <Card title="Revenue trend" subtitle="Daily completed payments" action={<span className="badge green"><TrendingUp size={12} /> {money(revenue.total)}</span>}>
          <RevenueChart byDay={revenue.byDay} />
        </Card>
        <Card title="Order status" subtitle="Current book distribution">
          <StatusDonut counts={metrics.orderCounts} />
        </Card>
      </div>

      <div className="grid two">
        <Card title="Service performance" subtitle="Demand and revenue by service" bodyClassName="table-wrap">
          {services.length === 0 ? (
            <Empty title="No services yet" message="Service performance appears after orders." />
          ) : (
            <table>
              <thead><tr><th>Service</th><th className="cell-right">Orders</th><th className="cell-right">Revenue</th></tr></thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.name}>
                    <td className="cell-strong">{service.name}</td>
                    <td className="cell-right">{service.orders}</td>
                    <td className="cell-right cell-strong">{money(service.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Team workload" subtitle="Completed work by employee" bodyClassName="table-wrap">
          {workload.length === 0 ? (
            <Empty title="No completed work yet" message="Workload appears as tasks are finished." />
          ) : (
            <table>
              <thead><tr><th>Employee</th><th>Role</th><th className="cell-right">Deliveries</th><th className="cell-right">Cleaning</th></tr></thead>
              <tbody>
                {workload.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-strong">{row.name}</td>
                    <td><StatusBadge status={row.role} /></td>
                    <td className="cell-right">{row.deliveries}</td>
                    <td className="cell-right">{row.cleaningTasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Payment methods" subtitle="Collected value by method">
          <div className="grid three">
            {Object.entries(revenue.byMethod).map(([method, amount]) => (
              <div className="detail-box" key={method}>
                <span>{method.replaceAll('_', ' ')}</span>
                <strong>{money(amount)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {toast ? <Toast {...toast} /> : null}
    </>
  );
}
