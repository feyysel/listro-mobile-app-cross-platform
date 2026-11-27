'use client';

import {
  ArrowRight,
  Droplets,
  Eye,
  EyeOff,
  LoaderCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, setSession } from '@/lib/api';
import { readThemePreference, themeIsDark, toggleTheme } from '@/lib/theme';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

const demoAccounts = [
  { role: 'Administrator', email: 'admin@listro.test', password: 'Admin@12345' },
  { role: 'Manager', email: 'manager@listro.test', password: 'Manager@123' },
  { role: 'Operator', email: 'operator@listro.test', password: 'Operator@123' },
  { role: 'Delivery', email: 'delivery@listro.test', password: 'Delivery@123' },
  { role: 'Customer', email: 'customer@listro.test', password: 'Customer@123' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('manager@listro.test');
  const [password, setPassword] = useState('Manager@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(themeIsDark(readThemePreference()));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession(result.accessToken, result.user);
      router.replace('/dashboard');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to reach the API. Make sure it is running on port 3000.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <button
        type="button"
        className="icon-button theme-floating"
        onClick={() => setDark(toggleTheme())}
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={dark}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <section className="login-side">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="brand-name">Listro</div>
            <div className="brand-sub">Shoe care OS</div>
          </div>
        </div>

        <div className="login-hero">
          <h1>Every pair, perfectly cared for.</h1>
          <p>
            One calm workspace for orders, pickup routes, cleaning benches, payments and
            customer updates — built for teams who care about the details.
          </p>
          <div className="login-feature">
            <span><ShieldCheck size={18} /></span>
            Role-aware workflows with server-side authorization
          </div>
          <div className="login-feature">
            <span><Droplets size={18} /></span>
            Live cleaning status from pickup to final polish
          </div>
          <div className="login-feature">
            <span><Truck size={18} /></span>
            Pickup and return visibility for every order
          </div>
        </div>

        <div className="login-quote">
          Designed for modern cleaning centers · Addis Ababa · ETB
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <h2>Welcome back</h2>
          <p>Sign in to your Listro operations workspace.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ paddingRight: 44 }}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  style={{ position: 'absolute', right: 4, top: 4, width: 36, height: 36, border: 0 }}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading ? <ArrowRight size={17} /> : null}
            </button>
            {error ? <div className="error-text">{error}</div> : null}
          </form>

          <div className="demo-heading">Quick demo access</div>
          <div className="demo-grid">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="demo-button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError('');
                }}
              >
                <strong>{account.role}</strong>
                <span>{account.email}</span>
              </button>
            ))}
          </div>
          <p style={{ marginTop: 20, fontSize: 12, color: '#98a1b2' }}>
            API docs are available at{' '}
            <Link href="http://localhost:3000/api/docs" style={{ color: '#5b5bd6' }}>
              localhost:3000/api/docs
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
