import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL não configurada');
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('connect', () => {
  console.log('Redis conectado');
});

// ============================================
// DEDUPLICAÇÃO
// ============================================

export async function isDuplicado(messageId: string): Promise<boolean> {
  const chave = `dedup:whatsapp:${messageId}`;
  const existe = await redis.exists(chave);

  if (existe) {
    return true;
  }

  // Define com TTL de 24 horas
  await redis.setex(chave, 86400, '1');
  return false;
}

// ============================================
// RATE LIMITING
// ============================================

export async function checkRateLimit(instanceId: string): Promise<boolean> {
  const chave = `ratelimit:whatsapp:${instanceId}`;
  const janela = 10; // segundos
  const limite = 30; // mensagens

  const atual = await redis.incr(chave);

  if (atual === 1) {
    await redis.expire(chave, janela);
  }

  return atual <= limite;
}

export async function getRateLimitRemaining(instanceId: string): Promise<number> {
  const chave = `ratelimit:whatsapp:${instanceId}`;
  const atual = await redis.get(chave);
  return 30 - (parseInt(atual || '0', 10));
}

// ============================================
// ESTADO PENDENTE (PIN de caixa)
// ============================================

interface EstadoPendente {
  comando: string;
  dados: Record<string, unknown>;
  timestamp: number;
}

export async function salvarEstadoPendente(
  userId: string,
  estado: EstadoPendente
): Promise<void> {
  const chave = `pending:caixa:${userId}`;
  await redis.setex(chave, 300, JSON.stringify(estado)); // 5 minutos
}

export async function obterEstadoPendente(userId: string): Promise<EstadoPendente | null> {
  const chave = `pending:caixa:${userId}`;
  const dados = await redis.get(chave);

  if (!dados) return null;

  return JSON.parse(dados) as EstadoPendente;
}

export async function removerEstadoPendente(userId: string): Promise<void> {
  const chave = `pending:caixa:${userId}`;
  await redis.del(chave);
}

// ============================================
// CACHE
// ============================================

export async function getCache<T>(chave: string): Promise<T | null> {
  const dados = await redis.get(chave);
  return dados ? JSON.parse(dados) : null;
}

export async function setCache<T>(
  chave: string,
  valor: T,
  ttlSegundos: number = 3600
): Promise<void> {
  await redis.setex(chave, ttlSegundos, JSON.stringify(valor));
}

export async function deleteCache(chave: string): Promise<void> {
  await redis.del(chave);
}
