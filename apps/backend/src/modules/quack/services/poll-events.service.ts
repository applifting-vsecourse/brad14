import { PollChange } from '@/modules/quack/domain/poll';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'pg';
import { Subject } from 'rxjs';

@Injectable()
export class PollEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PollEventsService.name);
  readonly events = new Subject<PollChange | null>();
  isReady = false;
  private client?: Client;
  private retry?: NodeJS.Timeout;
  private isStopped = false;
  async onModuleInit(): Promise<void> {
    if (!this.client) await this.connect();
  }
  private async connect(): Promise<void> {
    if (this.isStopped) return;
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });
    this.client = client;
    const disconnect = (): void => {
      if (this.client !== client || this.isStopped) return;
      this.client = undefined;
      this.isReady = false;
      this.events.next(null);
      void client.end().catch(() => undefined);
      this.retry = setTimeout(() => {
        void this.connect();
      }, 2000);
    };
    client.on('error', disconnect);
    client.on('end', disconnect);
    client.on('notification', (notification) => {
      if (!notification.payload) return;
      try {
        const event = JSON.parse(notification.payload) as Partial<PollChange>;
        if (
          typeof event.pollId === 'string' &&
          typeof event.revision === 'string' &&
          /^\d+$/.test(event.revision)
        ) {
          this.events.next({ pollId: event.pollId, revision: event.revision });
        }
      } catch {
        this.logger.warn('Invalid poll notification');
      }
    });
    try {
      await client.connect();
      await client.query('LISTEN poll_changes');
      if (this.client === client && !this.isStopped) this.isReady = true;
    } catch {
      this.logger.warn('Poll listener unavailable; reconnecting');
      disconnect();
    }
  }
  async onModuleDestroy(): Promise<void> {
    if (this.isStopped) return;
    this.isStopped = true;
    this.isReady = false;
    clearTimeout(this.retry);
    this.events.next(null);
    this.events.complete();
    await this.client?.end();
  }
}
