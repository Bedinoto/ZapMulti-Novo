import axios from 'axios';

const SERVER_URL = process.env.UAZAPI_SERVER_URL || 'https://bedinoto.uazapi.com';
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

async function listInstances() {
  console.log(`Listing instances on ${SERVER_URL}/instance/fetchInstances...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': ADMIN_TOKEN,
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
