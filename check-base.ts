import axios from 'axios';

async function checkBaseUrl() {
  try {
    const response = await axios.get('https://free.uazapi.com/');
    console.log('Base URL response:', response.data);
  } catch (error: any) {
    console.error('Base URL error:', error.response?.data || error.message);
  }
}

checkBaseUrl();
