import axios from 'axios';

async function checkAdminToken() {
  const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'celular';

  console.log(`Checking /instance/all with AdminToken header...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/all`, {
      headers: {
        'AdminToken': ADMIN_TOKEN
      }
    });
    const instance = response.data.find((i: any) => i.name === INSTANCE_NAME);
    if (instance) {
      console.log('Instance Details:', JSON.stringify(instance, null, 2));
    } else {
      console.log('Instance not found in /instance/all');
      console.log('All Instances:', JSON.stringify(response.data, null, 2));
    }
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

checkAdminToken();
