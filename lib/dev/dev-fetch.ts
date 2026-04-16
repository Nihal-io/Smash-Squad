'use client';

export function devFetch(url: string, options: RequestInit = {}) {
  const role =
    typeof window !== 'undefined'
      ? localStorage.getItem('festflow_dev_role') || 'coordinator'
      : 'coordinator';
  const headers = new Headers(options.headers);
  if (!headers.has('x-dev-role')) {
    headers.set('x-dev-role', role);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}
