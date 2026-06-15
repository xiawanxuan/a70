import mitt from 'mitt';
import type { EventType, EventPayload } from '../../types';

type EventMap = {
  [K in EventType]: EventPayload[K];
};

class EventBus {
  private emitter = mitt<EventMap>();

  public on<K extends EventType>(event: K, handler: (payload: EventPayload[K]) => void): void {
    this.emitter.on(event, handler);
  }

  public off<K extends EventType>(event: K, handler: (payload: EventPayload[K]) => void): void {
    this.emitter.off(event, handler);
  }

  public emit<K extends EventType>(event: K, payload: EventPayload[K]): void {
    this.emitter.emit(event, payload);
  }

  public once<K extends EventType>(event: K, handler: (payload: EventPayload[K]) => void): void {
    const onceHandler = (payload: EventPayload[K]) => {
      handler(payload);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  public removeAllListeners(event?: EventType): void {
    this.emitter.all.clear();
  }
}

export const eventBus = new EventBus();
