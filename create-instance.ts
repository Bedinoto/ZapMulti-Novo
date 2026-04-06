import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://free.uazapi.com';
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME;

async function createInstance() {
  try {
    console.log(`Creating instance ${INSTANCE_NAME} at ${SERVER_URL}...`);
    const response = await axios.post(`${SERVER_URL}/instance/create`, {
      instanceName: INSTANCE_NAME,
      token: process.env.UAZAPI_INSTANCE_TOKEN
    }, {
      headers: {
        'apikey': ADMIN_TOKEN
      }
    });
    console.log('Create response:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error creating instance:', error.response?.data || error.message);
  }
}

createInstance();
