import axios from 'axios';

async function updateInstance() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
  const WEBHOOK_URL = process.env.UAZAPI_WEBHOOK_URL;

  console.log(`Updating instance ${INSTANCE_NAME} using AdminToken header...`);
  try {
    const response = await axios.post(`${SERVER_URL}/instance/update`, {
      instanceName: INSTANCE_NAME,
      webhook_url: WEBHOOK_URL,
      webhook_enabled: true,
      webhook_events: ['messages', 'connection']
    }, {
      headers: {
        'AdminToken': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      }
    });
    console.log('SUCCESS:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

updateInstance();
