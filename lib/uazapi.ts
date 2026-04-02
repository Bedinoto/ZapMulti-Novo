import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'apikey': INSTANCE_TOKEN,
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
      const response = await api.get(`/instance/info/${INSTANCE_NAME}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getChats() {
    const response = await api.get(`/chat/fetchChats/${INSTANCE_NAME}`);
    return response.data;
  },

  async connect(phone?: string) {
    const response = await api.post(`/instance/connect/${INSTANCE_NAME}`, { phone });
    return response.data;
  },

  async disconnect() {
    const response = await api.post(`/instance/disconnect/${INSTANCE_NAME}`);
    return response.data;
  },

  async logout() {
    const response = await api.post(`/instance/logout/${INSTANCE_NAME}`);
    return response.data;
  },

  async sendText(number: string, text: string, options: any = {}) {
    const response = await api.post(`/send/text/${INSTANCE_NAME}`, {
      number: number.replace(/\D/g, ''),
      text,
      ...options,
    });
    return response.data;
  },

  async sendMedia(number: string, file: string, type: 'image' | 'video' | 'audio' | 'document', text?: string, fileName?: string, mimeType?: string) {
    const response = await api.post(`/send/media/${INSTANCE_NAME}`, {
      number: number.replace(/\D/g, ''),
      type,
      file,
      text,
      fileName,
      mimeType,
    });
    return response.data;
  },

  async updateWebhook(url: string, events: string[] = ['messages', 'connection']) {
    const response = await api.put(`/instance/webhook/${INSTANCE_NAME}`, {
      url,
      events,
      enabled: true,
      excludeMessages: ['wasSentByApi'],
    });
    return response.data;
  },
};
