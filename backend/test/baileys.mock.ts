/* eslint-disable @typescript-eslint/no-explicit-any -- mock d'une lib externe non typée pour jest */
// Mock CommonJS de @whiskeysockets/baileys (ESM-only) pour jest.
// Branché via moduleNameMapper dans les configs jest. N'affecte ni tsc ni l'exécution réelle.
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export const DisconnectReason = {
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  loggedOut: 401,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
};

// Réplique du BufferJSON de Baileys (sérialise/désérialise les Buffer).
export const BufferJSON = {
  replacer: (_key: string, value: any) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
      return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') };
    }
    return value;
  },
  reviver: (_key: string, value: any) => {
    if (value && typeof value === 'object' && (value.buffer === true || value.type === 'Buffer')) {
      const val = value.data || value.value;
      return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
    }
    return value;
  },
};

export const initAuthCreds = () => ({
  noiseKey: { private: randomBytes(32), public: randomBytes(32) },
  signedIdentityKey: { private: randomBytes(32), public: randomBytes(32) },
  registrationId: Math.floor(Math.random() * 16383) + 1,
  advSecretKey: randomBytes(32).toString('base64'),
  signalIdentities: [],
  firstUnuploadedPreKeyId: 1,
  nextPreKeyId: 1,
});

export const proto = {
  Message: {
    AppStateSyncKeyData: {
      fromObject: (obj: any) => obj,
    },
  },
};

export const makeCacheableSignalKeyStore = (store: any) => store;

export const fetchLatestBaileysVersion = async () => ({
  version: [2, 3000, 0] as [number, number, number],
  isLatest: true,
});

const makeWASocket = () => ({
  ev: new EventEmitter(),
  user: undefined,
  logout: async () => undefined,
  end: () => undefined,
});

export default makeWASocket;
