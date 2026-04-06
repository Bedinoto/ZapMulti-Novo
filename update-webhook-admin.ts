import axios from 'axios';

async function updateWebhookWithAdmin() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
  const WEBHOOK_URL = process.env.UAZAPI_WEBHOOK_URL;

  console.log(`Updating webhook for instance ${INSTANCE_NAME} using admin token...`);
  try {
    const response = await axios.post(`${SERVER_URL}/instance/webhook`, {
      instanceName: INSTANCE_NAME,
      url: WEBHOOK_URL,
      enabled: true,
      events: ['messages', 'connection']
    }, {
      headers: {
        'token': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      }
    });
    console.log('SUCCESS:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

updateWebhookWithAdmin();
