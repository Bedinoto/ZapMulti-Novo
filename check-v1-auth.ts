import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com/v1';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';
const INSTANCE_NAME = 'CwLZCX';

async function checkV1Auth() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL} using Authorization header...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'Authorization': ADMIN_TOKEN
      }
    });
    console.log('V1Auth info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('V1Auth error:', error.response?.data || error.message);
  }
}

checkV1Auth();
