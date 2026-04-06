import axios from 'axios';

async function checkV2() {
  const SERVER_URL = 'https://bedinoto.uazapi.com/v2';
  const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN;
  const INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'celular';

  console.log(`Checking instance ${INSTANCE_NAME} at ${SERVER_URL} with AdminToken header...`);
  try {
    const response = await axios.get(`${SERVER_URL}/instance/all`, {
      headers: {
        'AdminToken': ADMIN_TOKEN
      }
    });
    console.log('V2 SUCCESS:', JSON.stringify(response.data, null, 2).substring(0, 500));
  } catch (error: any) {
    console.error('V2 FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

checkV2();
