
import { uazapi } from './lib/uazapi';
import * as dotenv from 'dotenv';
dotenv.config();

async function testSendMedia() {
    try {
        const jid = '5555996636076@s.whatsapp.net'; // Real number from DB
        const res = await uazapi.sendMedia(jid, 'https://picsum.photos/200/300', 'image', 'Teste media');
        console.log('Response from sendMedia:', JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error('Error:', e.response?.data || e.message);
    }
}

testSendMedia();
