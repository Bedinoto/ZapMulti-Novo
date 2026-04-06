import axios from 'axios';

async function testLocalWebhook() {
  const WEBHOOK_URL = 'http://localhost:3000/api/uazapi/webhook';

  console.log(`Sending test webhook to ${WEBHOOK_URL}...`);
  try {
    const response = await axios.post(WEBHOOK_URL, {
      event: 'messages',
      instance: 'celular',
      data: {
        messages: [
          {
            key: {
              remoteJid: '555532511584@s.whatsapp.net',
              fromMe: false,
              id: 'TEST_MSG_' + Date.now()
            },
            message: {
              conversation: 'Test message from script'
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: 'Tester'
          }
        ]
      }
    });
    console.log('SUCCESS:', JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

testLocalWebhook();
