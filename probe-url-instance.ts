import axios from 'axios';

async function probeUrlWithInstance() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
  const WEBHOOK_URL = process.env.UAZAPI_WEBHOOK_URL;

  const endpoints = [
    `/instance/webhook/${INSTANCE_NAME}`,
    `/instance/update/${INSTANCE_NAME}`,
    `/instance/settings/${INSTANCE_NAME}`,
  ];

  for (const endpoint of endpoints) {
    console.log(`Checking POST endpoint: ${endpoint}...`);
    try {
      const response = await axios.post(`${SERVER_URL}${endpoint}`, {
        url: WEBHOOK_URL,
        enabled: true,
        events: ['messages', 'connection']
      }, {
        headers: {
          'AdminToken': ADMIN_TOKEN,
          'Content-Type': 'application/json',
        }
      });
      console.log(`Endpoint ${endpoint} SUCCESS:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      console.error(`Endpoint ${endpoint} FAILED:`, error.response?.status, error.response?.data || error.message);
    }
  }
}

probeUrlWithInstance();
