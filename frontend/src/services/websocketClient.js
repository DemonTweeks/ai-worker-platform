import { WS_URL } from '../config';

export default class JobWebSocketClient {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socket = null;
    this.jobId = '';
    this.reconnectTimer = null;
    this.closedByUser = false;
  }

  connect(jobId) {
    this.close();
    this.jobId = jobId;
    this.closedByUser = false;
    this.open();
  }

  open() {
    if (!this.jobId) return;
    this.setStatus('connecting');
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      this.setStatus('connected');
      this.socket.send(JSON.stringify({ action: 'subscribe', jobId: this.jobId }));
    };

    this.socket.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data));
      } catch (error) {
        this.onMessage({ type: 'ERROR', message: 'Invalid realtime message.' });
      }
    };

    this.socket.onerror = () => {
      this.setStatus('error');
    };

    this.socket.onclose = () => {
      this.setStatus('disconnected');
      if (!this.closedByUser && this.jobId) {
        this.scheduleReconnect();
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.setStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 3000);
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  setStatus(status) {
    if (this.onStatus) {
      this.onStatus(status);
    }
  }
}
