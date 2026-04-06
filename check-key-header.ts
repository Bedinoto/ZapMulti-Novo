import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';
const INSTANCE_NAME = 'CwLZCX';

async function checkKeyHeader() {
  try {
    console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL} using key header...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: {
        'key': ADMIN_TOKEN
      }
    });
    console.log('KeyHeader info:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('KeyHeader error:', error.response?.data || error.message);
  }
}

checkKeyHeader();
