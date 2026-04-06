import axios from 'axios';

async function checkRoot() {
  const urls = [
    'https://bedinoto.uazapi.com',
    'https://free.uazapi.com',
    'https://uazapi.com',
    'https://v2.uazapi.com',
  ];

  for (const url of urls) {
    try {
      console.log(`Checking ${url}...`);
      const response = await axios.get(url);
      console.log(`SUCCESS for ${url}! Status: ${response.status}`);
      console.log('Data:', JSON.stringify(response.data).substring(0, 200));
    } catch (error: any) {
      console.error(`Failed for ${url}:`, error.response?.status || error.message);
    }
  }
}

checkRoot();
