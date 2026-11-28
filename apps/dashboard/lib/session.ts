'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, SESSION_EVENT } from './api';

export function useStoredUser<T>(): T | null {
  const [user, setUser] = useState<T | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser<T>());
    sync();
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  return user;
}
