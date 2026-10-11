'use client';

import { useEffect, useState } from 'react';
import App from '@/src/components/App';
import LoginPage from '@/src/components/LoginPage';

export default function Page() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session check failed');
        return response.json();
      })
      .then((data) => setAuthenticated(data.authenticated === true))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Checking session...
      </div>
    );
  }

  return authenticated ? (
    <App />
  ) : (
    <LoginPage onLogin={() => setAuthenticated(true)} />
  );
}
