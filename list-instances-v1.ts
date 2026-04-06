import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com/v1';
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;

async function listInstances() {
  try {
    console.log('Listing instances using ADMIN_TOKEN with /v1...');
    const response = await axios.get(`${SERVER_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': ADMIN_TOKEN
      }
    });
    console.log('Instances:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error listing instances with /v1:', error.response?.data || error.message);
  }
}

listInstances();
