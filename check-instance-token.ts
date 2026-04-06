import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const INSTANCE_TOKEN = 'b6a3068d-7200-43c1-8c35-0f8f8cc85ea9';
const INSTANCE_NAME = 'CwLZCX';

async function checkInstance() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL} using INSTANCE_TOKEN...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': INSTANCE_TOKEN
      }
    });
    console.log('Instance info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error checking instance:', error.response?.data || error.message);
  }
}

checkInstance();
