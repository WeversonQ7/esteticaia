import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL não configurada');

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  return redis;
}

export async function isDuplicado(messageId: string): Promise<boolean> {
  const r = getRedis();
  const key = `dedup:whatsapp:${messageId}`;
  const existe = await r.exists(key);
  if (existe) return true;
  await r.setex(key, 86400, '1');
  return false;
}

export async function checkRateLimit(instanceId: string, maxRequests = 30, windowSeconds = 10): Promise<boolean> {
  const r = getRedis();
  const key = `ratelimit:whatsapp:${instanceId}`;
  const current = await r.incr(key);
  if (current === 1) await r.expire(key, windowSeconds);
  return current <= maxRequests;
}

export async function getRateLimitRemaining(instanceId: string, maxRequests = 30): Promise<number> {
  const r = getRedis();
  const key = `ratelimit:whatsapp:${instanceId}`;
  const current = await r.get(key);
  return maxRequests - (parseInt(current || '0', 10));
}

export async function setPendingPIN(userId: string, pin: string): Promise<void> {
  const r = getRedis();
  const key = `pending:caixa:${userId}`;
  await r.setex(key, 300, pin);
}

export async function validatePIN(userId: string, pin: string): Promise<boolean> {
  const r = getRedis();
  const key = `pending:caixa:${userId}`;
  const stored = await r.get(key);
  if (!stored) return false;
  const valido = stored === pin;
  if (valido) await r.del(key);
  return valido;
}

export async function hasPendingPIN(userId: string): Promise<boolean> {
  const r = getRedis();
  const key = `pending:caixa:${userId}`;
  return (await r.exists(key)) === 1;
}

export async function setAgendamentoPendente(agendamentoId: string, dados: string): Promise<void> {
  const r = getRedis();
  const key = `pending:agendamento:${agendamentoId}`;
  await r.setex(key, 600, dados);
}

export async function getAgendamentoPendente(agendamentoId: string): Promise<string | null> {
  const r = getRedis();
  const key = `pending:agendamento:${agendamentoId}`;
  return r.get(key);
}

export async function confirmarAgendamento(agendamentoId: string): Promise<void> {
  const r = getRedis();
  const key = `pending:agendamento:${agendamentoId}`;
  await r.del(key);
}
