import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get headers for a specific instance
const getHeaders = (instanceName?: string, instanceToken?: string) => ({
  'instance': instanceName || INSTANCE_NAME,
  'token': instanceToken || INSTANCE_TOKEN,
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
  async getStatus(instanceName?: string, instanceToken?: string): Promise<UazapiInstanceStatus> {
    try {
      const response = await api.get('/instance/status', {
        headers: getHeaders(instanceName, instanceToken)
      });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getChats(instanceName?: string, instanceToken?: string) {
    try {
      const response = await api.get('/chat/list', {
        headers: getHeaders(instanceName, instanceToken)
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn('UAZAPI getChats endpoint not found (404). Returning empty array.');
        return [];
      }
      throw error;
    }
  },

  async connect(phone?: string, instanceName?: string, instanceToken?: string) {
    const response = await api.post('/instance/connect', { phone }, {
      headers: getHeaders(instanceName, instanceToken)
    });
    return response.data;
  },

  async disconnect(instanceName?: string, instanceToken?: string) {
    const response = await api.post('/instance/disconnect', {}, {
      headers: getHeaders(instanceName, instanceToken)
    });
    return response.data;
  },

  async logout(instanceName?: string, instanceToken?: string) {
    const response = await api.post('/instance/logout', {}, {
      headers: getHeaders(instanceName, instanceToken)
    });
    return response.data;
  },

  async sendText(number: string, text: string, options: any = {}, instanceName?: string, instanceToken?: string) {
    const response = await api.post('/send/text', {
      number: number.replace(/\D/g, ''),
      text,
      ...options,
    }, {
      headers: getHeaders(instanceName, instanceToken)
    });
    return response.data;
  },

  async sendMedia(number: string, file: string, type: 'image' | 'video' | 'audio' | 'document', text?: string, fileName?: string, mimeType?: string, instanceName?: string, instanceToken?: string) {
    const response = await api.post('/send/media', {
      number: number.replace(/\D/g, ''),
      type,
      file,
      text,
      fileName,
      mimeType,
    }, {
      headers: getHeaders(instanceName, instanceToken)
    });
    return response.data;
  },

  async updateWebhook(url: string, events: string[] = ['messages', 'messages.upsert', 'messages.update', 'messages.set', 'connection', 'connection.update'], instanceName?: string, instanceToken?: string) {
    const response = await api.post('/webhook', {
      url,
      events,
      enabled: true,
      excludeMessages: [],
    }, {
      headers: getHeaders(instanceName, instanceToken)
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
