import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'token': INSTANCE_TOKEN,
    'instance': INSTANCE_NAME,
    'Content-Type': 'application/json',
  },
});

export interface UazapiInstanceStatus {
  instance: {
    id: string;
    name: string;
    status: 'connected' | 'connecting' | 'disconnected';
    profileName?: string;
    profilePicUrl?: string;
    qrcode?: string;
    paircode?: string;
  };
  status: {
    connected: boolean;
    loggedIn: boolean;
    jid?: {
      user: string;
      server: string;
    };
  };
}

export const uazapi = {
  async getStatus(): Promise<UazapiInstanceStatus> {
    try {
      const response = await api.get('/instance/status');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getChats() {
    try {
      const response = await api.get('/chat/list');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn('UAZAPI getChats endpoint not found (404). Returning empty array.');
        return [];
      }
      throw error;
    }
  },

  async connect(phone?: string) {
    const response = await api.post('/instance/connect', { phone });
    return response.data;
  },

  async disconnect() {
    const response = await api.post('/instance/disconnect');
    return response.data;
  },

  async logout() {
    const response = await api.post('/instance/logout');
    return response.data;
  },

  async sendText(number: string, text: string, options: any = {}) {
    const response = await api.post('/send/text', {
      number: number.replace(/\D/g, ''),
      text,
      ...options,
    });
    return response.data;
  },

  async sendMedia(number: string, file: string, type: 'image' | 'video' | 'audio' | 'document', text?: string, fileName?: string, mimeType?: string) {
    const response = await api.post('/send/media', {
      number: number.replace(/\D/g, ''),
      type,
      file,
      text,
      fileName,
      mimeType,
    });
    return response.data;
  },

  async updateWebhook(url: string, events: string[] = ['messages', 'messages.upsert', 'messages.update', 'messages.set', 'connection', 'connection.update']) {
    const response = await api.post('/webhook', {
      url,
      events,
      enabled: true,
      excludeMessages: [],
    });
    return response.data;
  },

  async createInstance(instanceName: string, token: string) {
    const response = await axios.post(`${SERVER_URL}/instance/create`, {
      instanceName,
      token,
    }, {
      headers: {
        'token': process.env.UAZAPI_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },
};
