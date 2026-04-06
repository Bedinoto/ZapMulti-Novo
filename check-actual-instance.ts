import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME;
const INSTANCE_TOKEN = process.env.UAZAPI_INSTANCE_TOKEN;

async function checkInstance() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL}...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': INSTANCE_TOKEN,
        'instance': INSTANCE_NAME
      }
    });
    console.log('Instance info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error checking instance:', error.response?.data || error.message);
  }
}

checkInstance();
