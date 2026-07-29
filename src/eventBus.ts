export interface BvpEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

type EventHandler = (event: BvpEvent) => void | Promise<void>;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private history: BvpEvent[] = [];
  private maxHistory = 100;

  on(type: string, handler: EventHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => this.listeners.get(type)?.delete(handler);
  }

  off(type: string, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, data: Record<string, unknown> = {}): void {
    const event: BvpEvent = { type, data, timestamp: Date.now() };

    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();

    const handlers = this.listeners.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) result.catch((err) => console.error(`[EventBus] Handler error:`, err));
      } catch (err) {
        console.error(`[EventBus] Handler error:`, err);
      }
    }
  }

  getHistory(type?: string): BvpEvent[] {
    if (type) return this.history.filter((e) => e.type === type);
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const eventBus = new EventBus();
