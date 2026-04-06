import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const INSTANCE_NAME = 'CelLoja';
const INSTANCE_TOKEN = '86acaac2-1c5c-4532-8f09-e15a7f1f3baf';

const api = axios.create({
  baseURL: SERVER_URL,
  headers: {
    'apikey': INSTANCE_TOKEN,
    'instance': INSTANCE_NAME,
    'Content-Type': 'application/json',
  },
});

async function checkWebhook() {
  try {
    const response = await api.get(`/instance/info/${INSTANCE_NAME}`);
    console.log('Instance Info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error fetching instance info:', error.response?.data || error.message);
  }
}

checkWebhook();
