import axios from 'axios';

async function checkAll() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

  console.log(`Checking /instance/all with AdminToken header...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/all`, {
      headers: {
        'AdminToken': ADMIN_TOKEN
      }
    });
    console.log('All Instances:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

checkAll();
