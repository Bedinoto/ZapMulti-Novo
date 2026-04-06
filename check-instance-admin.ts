import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'CelLoja';

async function checkInstance() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} using ADMIN_TOKEN...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': ADMIN_TOKEN
      }
    });
    console.log('Instance info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error checking instance:', error.response?.data || error.message);
  }
}

checkInstance();
