import axios from 'axios';

const SERVER_URL = 'https://uazapi.com';
const ADMIN_TOKEN = 'FGizKQFZpeTF4JqniyftBamjjEV0ZWgAMIApkIaOnsN9yZjsXe';
const INSTANCE_NAME = 'celular';

async function checkUazapiCom() {
  try {
    console.log(`Checking instance "${INSTANCE_NAME}" at ${SERVER_URL}...`);
    const response = await axios.get(`${SERVER_URL}/instance/info/${INSTANCE_NAME}`, {
      headers: { 'apikey': ADMIN_TOKEN }
    });
    console.log('Success:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.data || error.message);
  }
}

checkUazapiCom();
