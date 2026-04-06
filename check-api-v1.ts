import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com/api/v1';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';
const INSTANCE_NAME = 'CwLZCX';

async function checkApiV1() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL}...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'apikey': ADMIN_TOKEN
      }
    });
    console.log('ApiV1 info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('ApiV1 error:', error.response?.data || error.message);
  }
}

checkApiV1();
