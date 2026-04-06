import axios from 'axios';

const SERVER_URL = 'https://free.uazapi.com';
const ADMIN_TOKEN = 'ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t';

async function findListEndpoint() {
  const endpoints = [
    '/instance/fetchInstances',
    '/instance/list',
    '/instance/all',
    '/instance/getInstances',
    '/instance/status',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await axios.get(`${SERVER_URL}${endpoint}`, {
        headers: { 'apikey': ADMIN_TOKEN }
      });
      console.log(`SUCCESS for ${endpoint}! Status: ${response.status}`);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      return;
    } catch (error: any) {
      console.error(`Failed for ${endpoint}: ${error.response?.status}`);
    }
  }
}

findListEndpoint();
