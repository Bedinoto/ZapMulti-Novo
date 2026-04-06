import axios from 'axios';

async function probeAdmin() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

  const endpoints = [
    '/instance/list',
    '/instance/all',
    '/instance/fetch',
    '/instance/get',
    '/instance/info',
  ];

  for (const endpoint of endpoints) {
    console.log(`Checking ADMIN endpoint: ${endpoint}...`);
    try {
      const response = await axios.get(`${SERVER_URL}${endpoint}`, {
        headers: {
          'token': ADMIN_TOKEN,
          'apikey': ADMIN_TOKEN,
        }
      });
      console.log(`Endpoint ${endpoint} SUCCESS:`, JSON.stringify(response.data, null, 2).substring(0, 500));
    } catch (error: any) {
      console.error(`Endpoint ${endpoint} FAILED:`, error.response?.status, error.response?.data || error.message);
    }
  }
}

probeAdmin();
