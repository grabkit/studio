
'use client';

type EventHandler = (...args: any[]) => void;

class EventBus {
  private listeners: { [event: string]: EventHandler[] } = {};

  on(event: string, callback: EventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (listener) => listener !== callback
    );
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((listener) => listener(...args));
  }
}

export const eventBus = new EventBus();
