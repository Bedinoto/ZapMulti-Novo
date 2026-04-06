import axios from 'axios';

async function checkInfoWithApiKey() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
  const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

  console.log(`Checking info for instance: ${INSTANCE_NAME} with apikey header...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': INSTANCE_TOKEN,
        'instance': INSTANCE_NAME,
      }
    });
    console.log('SUCCESS:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

checkInfoWithApiKey();
