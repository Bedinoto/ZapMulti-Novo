import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL;
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME;

async function checkCurrentConfig() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL}...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': ADMIN_TOKEN
      }
    });
    console.log('Success:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkCurrentConfig();
