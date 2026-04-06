import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';

async function listInstancesAuth() {
  try {
    console.log('Listing instances using ADMIN_TOKEN with Authorization header...');
    const response = await axios.get(`${SERVER_URL}/instance/fetchInstances`, {
      headers: {
        'Authorization': ADMIN_TOKEN
      }
    });
    console.log('Instances:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error listing instances:', error.response?.data || error.message);
  }
}

listInstancesAuth();
