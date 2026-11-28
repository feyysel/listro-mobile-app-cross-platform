'use client';

import { LogOut, Server, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui';
import { getStoredUser, logout } from '@/lib/api';
import type { SessionUser } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const user = getStoredUser<SessionUser>();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="title">Settings</h1>
          <p className="subtitle">Session, access and integration details.</p>
        </div>
      </div>

      <div className="grid two">
        <Card title="Signed-in profile" subtitle="Your active Listro session" action={<StatusBadge status={user?.role ?? 'MEMBER'} />}>
          <div className="detail-grid">
            <div className="detail-box"><span>Name</span><strong>{user?.firstName ?? '—'} {user?.lastName ?? ''}</strong></div>
            <div className="detail-box"><span>Email</span><strong>{user?.email ?? '—'}</strong></div>
            <div className="detail-box"><span>User ID</span><strong>{user?.id ?? '—'}</strong></div>
            <div className="detail-box"><span>Customer ID</span><strong>{user?.customerId ?? '—'}</strong></div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button
              className="btn btn-danger"
              onClick={() => {
                void logout().then(() => router.replace('/login'));
              }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </Card>

        <div className="grid">
          <Card title="API connection" subtitle="Backend used by this dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="stat-icon teal"><Server size={19} /></span>
              <div>
                <strong>{apiBase}</strong>
                <div className="cell-muted">Swagger docs at /api/docs</div>
              </div>
            </div>
          </Card>
          <Card title="Security" subtitle="Access model">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="stat-icon"><ShieldCheck size={19} /></span>
              <div>
                <strong>Role-based access enforced server-side</strong>
                <div className="cell-muted">JWT access tokens, hashed refresh tokens and audit logs.</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="badge blue">{status}</span>;
}
