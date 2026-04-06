import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = 'FGizKQFZpeTF4JqniyftBamjjEV0ZWgAMIApkIaOnsN9yZjsXe';
const INSTANCE_NAME = 'celular';
const INSTANCE_TOKEN = 'a5fdab6f-0e1d-407c-aa4e-e6b44f935509';

async function tryCreateOnFree() {
  try {
    console.log(`Attempting to create instance "${INSTANCE_NAME}" at ${SERVER_URL} with new token...`);
    const response = await axios.post(`${SERVER_URL}/instance/create`, {
      instanceName: INSTANCE_NAME,
      token: INSTANCE_TOKEN,
    }, {
      headers: {
        'apikey': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    console.log('Success:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

tryCreateOnFree();
