'use client';

import { CheckCircle2, MapPin, Play, Truck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Loader, StatusBadge, Toast, dateTime } from '@/components/ui';
import { api, patch } from '@/lib/api';
import type { Delivery } from '@/lib/types';

const tabs = ['ALL', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDeliveries(await api<Delivery[]>('/deliveries/my'));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load deliveries', true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function update(id: string, nextStatus: string, message: string) {
    try {
      await patch(`/deliveries/${id}/status`, { status: nextStatus });
      notify(message);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Update failed', true);
    }
  }

  const visible = status === 'ALL' ? deliveries : deliveries.filter((delivery) => delivery.status === status);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Last mile</div>
          <h1 className="title">Deliveries</h1>
          <p className="subtitle">Pickup and return routes assigned to your team.</p>
        </div>
      </div>

      <div className="filters">
        <div className="tabs">
          {tabs.map((tab) => (
            <button key={tab} className={`tab${status === tab ? ' active' : ''}`} onClick={() => setStatus(tab)}>
              {tab === 'ALL' ? 'All routes' : tab.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid three">
        {loading ? (
          <Card title="Loading" subtitle="Fetching routes"><Loader /></Card>
        ) : visible.length === 0 ? (
          <Card title="No routes" subtitle="Nothing matches this filter"><Empty title="Clear roads" message="No deliveries to show." /></Card>
        ) : (
          visible.map((delivery) => {
            const customerName = `${delivery.order.customer.user.firstName} ${delivery.order.customer.user.lastName ?? ''}`.trim();
            return (
              <Card
                key={delivery.id}
                title={`${delivery.type === 'PICKUP' ? 'Pickup' : 'Return'} · ${delivery.order.bookingCode}`}
                subtitle={`Assigned to ${delivery.employee ? `${delivery.employee.user.firstName} ${delivery.employee.user.lastName ?? ''}` : 'unassigned'}`}
                action={<StatusBadge status={delivery.status} />}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span className="stat-icon"><MapPin size={18} /></span>
                  <div>
                    <strong>{customerName}</strong>
                    <div className="cell-muted">{String((delivery.address as Record<string, unknown> | null)?.addressLine ?? 'Address on file')}</div>
                  </div>
                </div>
                <div className="detail-grid">
                  <div className="detail-box"><span>Order status</span><strong>{delivery.order.status.replaceAll('_', ' ')}</strong></div>
                  <div className="detail-box"><span>Scheduled</span><strong>{dateTime(delivery.scheduledAt)}</strong></div>
                </div>
                <div className="drawer-actions" style={{ marginTop: 16 }}>
                  {delivery.status === 'ASSIGNED' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => void update(delivery.id, 'IN_PROGRESS', 'Route started')}>
                      <Play size={14} /> Start route
                    </button>
                  ) : null}
                  {delivery.status === 'IN_PROGRESS' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => void update(delivery.id, 'COMPLETED', 'Delivery completed')}>
                      <CheckCircle2 size={14} /> Complete
                    </button>
                  ) : null}
                  {['ASSIGNED', 'IN_PROGRESS'].includes(delivery.status) ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const reason = window.prompt('Reason for failed delivery');
                        if (reason) void patch(`/deliveries/${delivery.id}/status`, { status: 'FAILED', reason }).then(() => {
                          notify('Delivery marked failed');
                          void refresh();
                        });
                      }}
                    >
                      Mark failed
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>
      {toast ? <Toast {...toast} /> : null}
    </>
  );
}
