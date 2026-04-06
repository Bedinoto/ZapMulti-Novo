import { uazapi } from './lib/uazapi';

async function registerWebhook() {
  const webhookUrl = process.env.UAZAPI_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('UAZAPI_WEBHOOK_URL not set');
    return;
  }

  console.log(`Registering webhook: ${webhookUrl}...`);
  try {
    const response = await uazapi.updateWebhook(webhookUrl);
    console.log('SUCCESS!');
    console.log('Response:', JSON.stringify(response, null, 2));
  } catch (error: any) {
    console.error('FAILED!');
    console.error('Status:', error.response?.status);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2) || error.message);
  }
}

registerWebhook();
