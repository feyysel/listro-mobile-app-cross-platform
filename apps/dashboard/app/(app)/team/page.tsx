'use client';

import { Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Loader, StatusBadge, Toast } from '@/components/ui';
import { api } from '@/lib/api';

interface EmployeeApiItem {
  id: string;
  employeeCode: string;
  status: string;
  user: {
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    role: string;
  };
  branchMemberships: Array<{ branch: { name: string; code: string } }>;
}

interface EmployeeRow {
  id: string;
  employeeCode: string;
  status: string;
  role: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  branches: Array<{ branch: { name: string; code: string } }>;
}

export default function TeamPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  const notify = useCallback((message: string, error?: boolean) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    api<{ items: EmployeeApiItem[] }>('/employees?limit=100')
      .then((result) =>
        setEmployees(
          result.items.map((employee) => ({
            id: employee.id,
            employeeCode: employee.employeeCode,
            status: employee.status,
            role: employee.user.role,
            firstName: employee.user.firstName,
            lastName: employee.user.lastName,
            email: employee.user.email,
            phone: employee.user.phone,
            branches: employee.branchMemberships,
          })),
        ),
      )
      .catch((error) => notify(error instanceof Error ? error.message : 'Unable to load team', true))
      .finally(() => setLoading(false));
  }, [notify]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">People</div>
          <h1 className="title">Team</h1>
          <p className="subtitle">Delivery partners, operators and branch managers.</p>
        </div>
      </div>

      <div className="grid three">
        {loading ? (
          <Card title="Loading" subtitle="Fetching team"><Loader /></Card>
        ) : employees.length === 0 ? (
          <Card title="No team members" subtitle="Add employees from the API"><Empty title="Empty team" message="Employee accounts will appear here." /></Card>
        ) : (
          employees.map((employee) => (
            <Card
              key={employee.id}
              title={`${employee.firstName} ${employee.lastName ?? ''}`}
              subtitle={employee.employeeCode}
              action={<StatusBadge status={employee.status} />}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span className="stat-icon"><Users size={19} /></span>
                <div>
                  <strong>{employee.role.replaceAll('_', ' ')}</strong>
                  <div className="cell-muted">{employee.email}</div>
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-box"><span>Phone</span><strong>{employee.phone ?? '—'}</strong></div>
                <div className="detail-box"><span>Branch</span><strong>{employee.branches[0]?.branch.code ?? '—'}</strong></div>
              </div>
            </Card>
          ))
        )}
      </div>
      {toast ? <Toast {...toast} /> : null}
    </>
  );
}
