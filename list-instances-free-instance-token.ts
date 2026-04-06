import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const INSTANCE_TOKEN = '86acaac2-1c5c-4532-8f09-e15a7f1f3baf';

async function listInstances() {
  console.log(`Listing instances on ${SERVER_URL}/instance/fetchInstances with instance token...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': INSTANCE_TOKEN,
      },
    });
    console.log('SUCCESS!');
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED!');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

listInstances();
