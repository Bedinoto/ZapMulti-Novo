import { uazapi } from './lib/uazapi';
import axios from 'axios';

async function checkConfig() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

  console.log(`Checking config for instance: ${INSTANCE_NAME}...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/settings`, {
      headers: {
        'token': INSTANCE_TOKEN,
        'instance': INSTANCE_NAME,
      }
    });
    console.log('Instance Settings:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Failed to get settings:', error.response?.status, error.response?.data || error.message);
  }

  try {
    const response = await axios.get(`${SERVER_URL}/instance/webhook`, {
      headers: {
        'token': INSTANCE_TOKEN,
        'instance': INSTANCE_NAME,
      }
    });
    console.log('Webhook Config:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Failed to get webhook config:', error.response?.status, error.response?.data || error.message);
  }
}

checkConfig();
