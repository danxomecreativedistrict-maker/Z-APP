/* eslint-disable @typescript-eslint/no-explicit-any -- adaptateur bas niveau pour le SignalKeyStore de Baileys */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import {
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { RedisService } from '../redis/redis.service';

export interface RedisAuthState {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clear: () => Promise<void>;
}

/** Dérive une clé AES-256 (32 octets) à partir d'un secret. */
export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payload: string, key: Buffer): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * État d'authentification Baileys persisté (chiffré) dans Redis, isolé par entreprise.
 * Les `creds` et chaque clé de signal sont stockés sous `wa:<companyId>:<name>`.
 */
export async function useRedisAuthState(
  redis: RedisService,
  companyId: string,
  encKey: Buffer,
): Promise<RedisAuthState> {
  const prefix = `wa:${companyId}:`;

  const writeData = (value: any, name: string): Promise<void> =>
    redis.set(prefix + name, encrypt(JSON.stringify(value, BufferJSON.replacer), encKey));

  const readData = async (name: string): Promise<any> => {
    const raw = await redis.get(prefix + name);
    if (!raw) return null;
    try {
      return JSON.parse(decrypt(raw, encKey), BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = (name: string): Promise<number> => redis.del(prefix + name);

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) result[id] = value;
            }),
          );
          return result;
        },
        set: async (data: any) => {
          const tasks: Promise<unknown>[] = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const name = `${category}-${id}`;
              tasks.push(value ? writeData(value, name) : removeData(name));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(creds, 'creds'),
    clear: async () => {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) await redis.del(...keys);
    },
  };
}
