/** Shared HTTP helpers built on axios. */
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

export function createHttpClient(config: AxiosRequestConfig = {}): AxiosInstance {
  return axios.create({
    timeout: 60_000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    ...config,
  });
}

export async function downloadToBuffer(url: string, timeoutMs = 180_000): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: timeoutMs,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return Buffer.from(res.data);
}

export function describeAxiosError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body = err.response?.data;
    const detail =
      typeof body === 'string'
        ? body
        : body
          ? JSON.stringify(body).slice(0, 500)
          : err.message;
    return status ? `HTTP ${status}: ${detail}` : detail;
  }
  return err instanceof Error ? err.message : String(err);
}
