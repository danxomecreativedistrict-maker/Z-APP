import { EventEmitter } from 'events';
import { Injectable } from '@nestjs/common';

export type RealtimeEventName = 'message' | 'order' | 'notification' | 'prospect';

export type RealtimeListener = (companyId: string, payload: unknown) => void;

/**
 * Bus d'événements applicatif (in-process) reliant les services métier au
 * DashboardGateway (Socket.IO). Singleton global : tout émetteur et le gateway
 * partagent le même EventEmitter.
 */
@Injectable()
export class RealtimeService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(event: RealtimeEventName, companyId: string, payload: unknown): void {
    this.emitter.emit(event, companyId, payload);
  }

  on(event: RealtimeEventName, listener: RealtimeListener): void {
    this.emitter.on(event, listener);
  }
}
