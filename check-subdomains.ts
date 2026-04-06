import axios from 'axios';

async function checkApi() {
  const urls = [
    'https://api.uazapi.com',
    'https://v1.uazapi.com',
    'https://v2.uazapi.com',
    'https://app.uazapi.com',
    'https://panel.uazapi.com',
  ];

  for (const url of urls) {
    try {
      console.log(`Checking ${url}...`);
      const response = await axios.get(url);
      console.log(`SUCCESS for ${url}! Status: ${response.status}`);
    } catch (error: any) {
      console.error(`Failed for ${url}:`, error.response?.status || error.message);
    }
  }
}

checkApi();
