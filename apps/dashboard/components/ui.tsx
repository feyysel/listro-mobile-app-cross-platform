import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react';

const statusTone: Record<string, string> = {
  PLACED: 'blue',
  CONFIRMED: 'purple',
  DELIVERY_ASSIGNED: 'blue',
  PICKUP_IN_PROGRESS: 'amber',
  RECEIVED_AT_CENTER: 'teal',
  WASHING_IN_PROGRESS: 'purple',
  WASHING_COMPLETED: 'teal',
  READY_FOR_DELIVERY: 'green',
  OUT_FOR_DELIVERY: 'amber',
  DELIVERED: 'green',
  CANCELLED: 'rose',
  REJECTED: 'rose',
  PENDING: 'amber',
  ASSIGNED: 'blue',
  IN_PROGRESS: 'purple',
  COMPLETED: 'green',
  FAILED: 'rose',
  CASH: 'teal',
  TELEBIRR: 'blue',
  CBE_BIRR: 'blue',
  BANK_TRANSFER: 'purple',
  CARD: 'purple',
  PAID: 'green',
};

export function humanStatus(status: string): string {
  return status.replaceAll('_', ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusTone[status] ?? ''}`}>{humanStatus(status)}</span>;
}

export function money(value: string | number, currency = 'ETB'): string {
  return `${currency} ${Number(value).toLocaleString('en-ET', { maximumFractionDigits: 2 })}`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = '',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${tone}`}>{icon}</div>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-delta muted">{hint}</div> : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  bodyClassName = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

export function Loader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loader">
      <div>
        <div className="spinner" />
        {label}
      </div>
    </div>
  );
}

export function Empty({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Inbox size={24} /></div>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function Toast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className={`toast${error ? ' error' : ''}`}>
      {error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
      {message}
    </div>
  );
}
