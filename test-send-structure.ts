
import { uazapi } from './lib/uazapi';
import * as dotenv from 'dotenv';
dotenv.config();

async function testSend() {
    try {
        const jid = '5555996636076@s.whatsapp.net'; // Real number from DB
        const res = await uazapi.sendText(jid, 'Teste estrutura');
        console.log('Response from sendText:', JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error('Error:', e.response?.data || e.message);
    }
}

testSend();
