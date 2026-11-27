'use client';

import { Search, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Loader, money, StatusBadge, Toast, dateTime } from '@/components/ui';
import { api } from '@/lib/api';

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  orders: number;
  activeOrders: number;
  lifetimeValue: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      setCustomers(await api<CustomerRow[]>(`/customers${query}`));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to load customers', true);
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Relationships</div>
          <h1 className="title">Customers</h1>
          <p className="subtitle">Know your regulars, their orders and their lifetime value.</p>
        </div>
        <div className="header-actions">
          <span className="badge blue">{customers.length} customers</span>
        </div>
      </div>

      <div className="filters">
        <div className="search" style={{ width: 320 }}>
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" />
        </div>
      </div>

      <Card title="Customer directory" subtitle="Sorted by most recent signup" bodyClassName="table-wrap">
        {loading ? (
          <Loader />
        ) : customers.length === 0 ? (
          <Empty title="No customers found" message="Try another search term." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="cell-right">Orders</th>
                <th className="cell-right">Active</th>
                <th className="cell-right">Lifetime value</th>
                <th className="cell-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="avatar">{`${customer.firstName[0] ?? ''}${customer.lastName?.[0] ?? ''}`.toUpperCase()}</span>
                      <div>
                        <div className="cell-strong">{customer.firstName} {customer.lastName ?? ''}</div>
                        <div className="cell-muted">{customer.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-muted">{customer.phone ?? '—'}</td>
                  <td><StatusBadge status={customer.status} /></td>
                  <td className="cell-right">{customer.orders}</td>
                  <td className="cell-right">{customer.activeOrders}</td>
                  <td className="cell-right cell-strong">{money(customer.lifetimeValue)}</td>
                  <td className="cell-right cell-muted">{dateTime(customer.createdAt)}</td>
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
