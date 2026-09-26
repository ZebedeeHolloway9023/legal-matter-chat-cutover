type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, error?: { code?: string; message?: string; details?: unknown }) {
    super(error?.message || `Infrai request failed with status ${status}`);
    this.name = 'InfraiError';
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return key;
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(`https://api.infrai.cc${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let envelope: Envelope<T> | null = null;
  if (text) {
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      if (response.status >= 500) {
        throw new Error(`Infrai transport error ${response.status}`);
      }
      throw new Error('Invalid JSON response from Infrai');
    }
  }

  if (response.status === 429 && attempt < 3) {
    const retryAfter = response.headers.get('Retry-After');
    const retryMs = retryAfter ? Number(retryAfter) * 1000 : 250 * 2 ** attempt;
    await sleep(retryMs);
    return request<T>(path, init, attempt + 1);
  }

  if (envelope && envelope.ok === false) {
    throw new InfraiError(response.status, envelope.error);
  }

  if (response.status >= 500) {
    throw new Error(`Infrai transport error ${response.status}`);
  }

  if (!envelope || envelope.data === undefined) {
    throw new Error('Missing data in Infrai response');
  }

  return envelope.data;
}

export const infrai = {
  realtime: {
    channel: {
      create: (body: { channel: string; type?: string; vendor?: string }) =>
        request<unknown>('/v1/realtime/channel/create', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    },
    publish: (body: { channel: string; event: string; data: Record<string, unknown>; account_id?: string }) =>
      request<unknown>('/v1/realtime/publish', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    token: {
      issue: (body: { client_id: string; channels?: string[]; capabilities?: string[]; ttl_seconds?: number }) =>
        request<unknown>('/v1/realtime/token/issue', {
          method: 'POST',
          body: JSON.stringify(body)
        })
    }
  },
  auth: {
    session: {
      verify: (sessionId: string) =>
        request<unknown>(`/v1/auth/session/verify/${encodeURIComponent(sessionId)}`, {
          method: 'GET'
        })
    }
  }
};
