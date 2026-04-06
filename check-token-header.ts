import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';
const INSTANCE_NAME = 'CwLZCX';

async function checkTokenHeader() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL} using token header...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'token': ADMIN_TOKEN
      }
    });
    console.log('TokenHeader info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('TokenHeader error:', error.response?.data || error.message);
  }
}

checkTokenHeader();
