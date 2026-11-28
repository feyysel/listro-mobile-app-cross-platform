'use client';

import { useEffect, useRef } from 'react';
import { getToken, refreshAccessToken, SESSION_EVENT } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export const DATA_EVENT = 'listro:data';

export interface RealtimeMessage {
  type: string;
  data: Record<string, unknown>;
}

type Handler = (message: RealtimeMessage) => void;

const handlers = new Set<Handler>();
let controller: AbortController | null = null;
let reconnectTimer: number | null = null;

function parseBlock(block: string): RealtimeMessage | null {
  let type = 'message';
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  try {
    return { type, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
  } catch {
    return null;
  }
}

function disconnect(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  controller?.abort();
  controller = null;
}

async function connect(): Promise<void> {
  if (controller || typeof window === 'undefined' || handlers.size === 0) return;
  const token = getToken();
  if (!token) return;

  const abort = new AbortController();
  controller = abort;

  try {
    const response = await fetch(`${API_BASE}/events`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: abort.signal,
      cache: 'no-store',
    });
    if (response.status === 401) {
      await refreshAccessToken();
      throw new Error('Session refreshed');
    }
    if (!response.ok || !response.body) throw new Error(`Realtime stream failed: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!abort.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const message = parseBlock(block);
        if (!message) continue;
        for (const handler of handlers) handler(message);
        if (message.type === 'notification') {
          window.dispatchEvent(new CustomEvent(DATA_EVENT, { detail: message }));
        }
      }
    }
  } catch {
  } finally {
    if (controller === abort) controller = null;
    if (handlers.size > 0 && !abort.signal.aborted && reconnectTimer === null && getToken()) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 2000);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(SESSION_EVENT, () => {
    if (!getToken()) disconnect();
    else void connect();
  });
}

export function useRealtime(handler: Handler): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrapped: Handler = (message) => handlerRef.current(message);
    handlers.add(wrapped);
    void connect();
    return () => {
      handlers.delete(wrapped);
      if (handlers.size === 0) disconnect();
    };
  }, []);
}

export function useLiveRefresh(refresh: () => void | Promise<void>): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const listener = () => void refreshRef.current();
    window.addEventListener(DATA_EVENT, listener);
    return () => window.removeEventListener(DATA_EVENT, listener);
  }, []);
}
