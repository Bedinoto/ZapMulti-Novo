import axios from 'axios';

async function checkRoot() {
  const url = 'https://bedinoto.uazapi.com';
  try {
    console.log(`Checking ${url}...`);
    const response = await axios.get(url);
    console.log(`SUCCESS! Status: ${response.status}`);
    console.log('Data:', JSON.stringify(response.data).substring(0, 200));
  } catch (error: any) {
    console.error(`Failed: ${error.response?.status}`);
  }
}

checkRoot();
