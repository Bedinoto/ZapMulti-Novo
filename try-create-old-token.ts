import axios from 'axios';

const SERVER_URL = 'https://bedinoto.uazapi.com';
const OLD_ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';
const INSTANCE_NAME = 'celular';
const INSTANCE_TOKEN = 'a5fdab6f-0e1d-407c-aa4e-e6b44f935509';

async function tryCreateWithOldToken() {
  try {
    console.log(`Attempting to create instance "${INSTANCE_NAME}" at ${SERVER_URL} with OLD token...`);
    const response = await axios.post(`${SERVER_URL}/instance/create`, {
      instanceName: INSTANCE_NAME,
      token: INSTANCE_TOKEN,
    }, {
      headers: {
        'apikey': OLD_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    console.log('Success:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

tryCreateWithOldToken();
