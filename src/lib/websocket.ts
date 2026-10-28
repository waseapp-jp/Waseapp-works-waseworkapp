/**
 * WaseWorkApp WebSocket Client
 * Real-time event broker with automatic reconnection and WebRTC signaling
 */

type EventHandler = (data: any) => void;

class RealtimeSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private isConnected = false;
  private reconnectTimer: any = null;
  private pendingQueue: any[] = [];
  public userId: string = `u-${Math.random().toString(36).substring(2, 8)}`;
  public userName: string = 'あなた (WaseWork)';

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send('user:identify', { userId: this.userId, userName: this.userName });

        // Flush pending queue
        while (this.pendingQueue.length > 0) {
          const item = this.pendingQueue.shift();
          this.sendRaw(item);
        }

        this.emitLocal('connection:change', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type) {
            this.emitLocal(data.type, data.payload);
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emitLocal('connection:change', { connected: false });
        // Auto-reconnect after 2 seconds
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error, retrying...', err);
      };
    } catch (e) {
      console.error('WebSocket initialization error:', e);
    }
  }

  public send(type: string, payload: any) {
    const data = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.pendingQueue.push(data);
      this.connect();
    }
  }

  private sendRaw(data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  public on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unbind function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`Error in WS event listener for ${event}:`, err);
        }
      });
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const socketClient = new RealtimeSocketClient();
