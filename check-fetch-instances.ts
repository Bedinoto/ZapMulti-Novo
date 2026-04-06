import axios from 'axios';

async function checkFetchInstances() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

  console.log(`Checking /instance/fetchInstances with AdminToken header...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/fetchInstances`, {
      headers: {
        'AdminToken': ADMIN_TOKEN
      }
    });
    console.log('SUCCESS:', JSON.stringify(response.data, null, 2).substring(0, 500));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

checkFetchInstances();
