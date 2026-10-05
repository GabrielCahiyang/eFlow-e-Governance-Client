import { controlPanelFetch, normalizeControlPanelBase, resolveControlPanelBase } from './controlPanelClient';

export async function phase2Request<T>(path: string, init: RequestInit = {}, anonymous = false): Promise<T> {
  const options: RequestInit = { ...init, cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json', ...init.headers } };
  const response = anonymous
    ? await fetch(`${normalizeControlPanelBase(import.meta.env.VITE_EFLOW_GATEWAY_URL || '') || await resolveControlPanelBase()}${path}`, options)
    : await controlPanelFetch(path, options, { retryOnEndpointChange: false, timeoutMs: 30000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'This action could not finish. Please try again.');
  return body as T;
}

export const jsonRequest = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
