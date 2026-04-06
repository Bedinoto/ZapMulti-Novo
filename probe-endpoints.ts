import axios from 'axios';

async function checkInfo() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

  const endpoints = [
    '/instance/info',
    '/instance/status',
    '/instance/settings',
    '/instance/webhook',
    '/instance/list',
    '/instance/all',
  ];

  for (const endpoint of endpoints) {
    console.log(`Checking endpoint: ${endpoint}...`);
    try {
      const response = await axios.get(`${SERVER_URL}${endpoint}`, {
        headers: {
          'token': INSTANCE_TOKEN,
          'instance': INSTANCE_NAME,
        }
      });
      console.log(`Endpoint ${endpoint} SUCCESS:`, JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error: any) {
      console.error(`Endpoint ${endpoint} FAILED:`, error.response?.status);
    }
  }
}

checkInfo();
