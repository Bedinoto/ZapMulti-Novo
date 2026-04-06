import axios from 'axios';

async function checkServer() {
  try {
    const response = await axios.get('https://bedinoto.uazapi.com/');
    console.log('Server response:', response.status, response.data);
  } catch (error: any) {
    console.error('Server error:', error.response?.status, error.response?.data || error.message);
  }
}

checkServer();
