'use client';

import {
  BarChart3,
  Bell,
  Boxes,
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Settings,
  Sparkles,
  Sun,
  Truck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  api,
  getStoredUser,
  getToken,
  logout,
  restoreSession,
  SESSION_EVENT,
} from '@/lib/api';
import { readThemePreference, themeIsDark, toggleTheme } from '@/lib/theme';
import type { Role, SessionUser } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  roles?: Role[];
}

const mainNav: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Orders', href: '/orders', icon: Boxes },
  { label: 'Cleaning', href: '/washing', icon: Sparkles, roles: ['OPERATOR', 'MANAGER', 'ADMIN'] },
  { label: 'Deliveries', href: '/deliveries', icon: Truck, roles: ['DELIVERY', 'MANAGER', 'ADMIN'] },
  { label: 'Payments', href: '/payments', icon: CreditCard, roles: ['MANAGER', 'ADMIN'] },
];

const manageNav: NavItem[] = [
  { label: 'Customers', href: '/customers', icon: CircleUserRound, roles: ['ADMIN'] },
  { label: 'Team', href: '/team', icon: Users, roles: ['MANAGER', 'ADMIN'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['MANAGER', 'ADMIN'] },
  { label: 'Settings', href: '/settings', icon: Settings },
];

function visible(items: NavItem[], role?: Role) {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; createdAt: string }>>([]);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(themeIsDark(readThemePreference()));
  }, []);

  useEffect(() => {
    let active = true;
    const syncSession = () => {
      if (!getToken()) {
        router.replace('/login');
        return;
      }
      setUser(getStoredUser<SessionUser>());
    };

    syncSession();
    window.addEventListener(SESSION_EVENT, syncSession);
    if (getToken()) {
      void restoreSession().then((valid) => {
        if (active && !valid) router.replace('/login');
      });
    }

    return () => {
      active = false;
      window.removeEventListener(SESSION_EVENT, syncSession);
    };
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    api<{ items: Array<{ id: string; title: string; message: string; createdAt: string }> }>(
      '/notifications?limit=5',
    )
      .then((result) => setNotifications(result.items))
      .catch(() => setNotifications([]));
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'L';

  function signOut() {
    void logout().then(() => router.replace('/login'));
  }

  function renderNav(items: NavItem[]) {
    return visible(items, user?.role).map((item) => {
      const Icon = item.icon;
      const active = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item${active ? ' active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        >
          <Icon size={18} />
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="shell">
      <div
        className={`mobile-overlay${sidebarOpen ? ' show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={22} /></div>
          <div>
            <div className="brand-name">Listro</div>
            <div className="brand-sub">Shoe care OS</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">Workspace</div>
          {renderNav(mainNav)}
          <div className="nav-section">Management</div>
          {renderNav(manageNav)}
        </nav>

        <div className="sidebar-footer">
          <div className="branch-chip">
            <strong>Dire Dawa Cleaning Center</strong>
            <span>DIRE-01 · Dire Dawa</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={21} />
            </button>
            <form
              className="search"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(`/orders?search=${encodeURIComponent(search)}`);
              }}
            >
              <PackageCheck size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search booking code or customer…"
                aria-label="Search orders"
              />
            </form>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setDark(toggleTheme())}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={dark}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="icon-button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {notifications.some((item) => item.title) ? <span className="dot" /> : null}
              </button>
              {notificationsOpen ? (
                <div className="notification-panel">
                  <div className="card-title">Notifications</div>
                  {notifications.length === 0 ? (
                    <p className="cell-muted">You are all caught up.</p>
                  ) : (
                    notifications.map((item) => (
                      <div key={item.id} className="notification-item">
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <button className="icon-button" onClick={signOut} aria-label="Sign out">
              <LogOut size={18} />
            </button>
            <div className="profile">
              <div className="avatar">{initials}</div>
              <div className="profile-meta">
                <strong>{user?.firstName ?? 'User'} {user?.lastName ?? ''}</strong>
                <span>{user?.role?.toLowerCase() ?? 'member'}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
