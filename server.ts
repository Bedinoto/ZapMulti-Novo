import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import express from 'express';
import { Server } from 'socket.io';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState as makeMultiFileAuthState, 
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Handle Next.js import for ESM
const nextApp = (next as any).default || next;
const app = nextApp({ dev, hostname, port });
const handle = app.getRequestHandler();

function normalizeJid(rawJid: string): string {
    if (!rawJid) return '';
    let jid = jidNormalizedUser(rawJid);
    if (jid.endsWith('@c.us')) jid = jid.replace('@c.us', '@s.whatsapp.net');
    if (jid.endsWith('@lid')) jid = jid.replace('@lid', '@s.whatsapp.net');
    return jid;
}

async function mergeChatsIfNeeded(sessionId: string, jid: string, state: any, io: Server) {
    if (!jid) return;
    
    // Ensure we have the @s.whatsapp.net version for our internal storage keys
    const normalizedJid = normalizeJid(jid);
    
    // But for lid-mapping lookup, we might need the @lid version if it's an LID
    // Baileys usually stores them with their native domain in the key-value store
    const lidJid = jid.includes('@') ? (jid.split('@')[0] + '@lid') : (jid + '@lid');
    const pnJidNative = jid.includes('@') ? (jid.split('@')[0] + '@s.whatsapp.net') : (jid + '@s.whatsapp.net');

    try {
        // Try looking up by the jid as provided, and also by its LID/PN variants
        const lookups = [jid, lidJid, pnJidNative];
        const mappings = await state.keys.get('lid-mapping', lookups);
        
        if (mappings) {
            for (const [key, value] of Object.entries(mappings)) {
                if (!value) continue;
                
                const otherJidRaw = typeof value === 'string' ? value : (value as any)?.pn || (value as any)?.lid;
                if (!otherJidRaw) continue;

                const jid1 = normalizeJid(key);
                const jid2 = normalizeJid(otherJidRaw);
                
                const chatKey1 = `${sessionId}--${jid1}`;
                const chatKey2 = `${sessionId}--${jid2}`;
                
                if (chatKey1 === chatKey2) continue;

                // We have two different keys that represent the same person
                if (chats[chatKey1] && chats[chatKey2]) {
                    console.log(`Merging chats: ${chatKey1} and ${chatKey2}`);
                    // Merge into the one that is NOT an LID if possible, or just the first one
                    // Usually the one with more messages or the one that is a PN
                    const isJid1Lid = key.includes('@lid');
                    const sourceKey = isJid1Lid ? chatKey1 : chatKey2;
                    const targetKey = isJid1Lid ? chatKey2 : chatKey1;
                    const sourceJid = isJid1Lid ? jid1 : jid2;

                    console.log(`Source: ${sourceKey}, Target: ${targetKey}`);

                    // Merge messages
                    const mergedMessages = [
                        ...chats[targetKey].messages,
                        ...chats[sourceKey].messages
                    ].sort((a, b) => (a.messageTimestamp as number) - (b.messageTimestamp as number));
                    
                    // Deduplicate
                    const seen = new Set();
                    chats[targetKey].messages = mergedMessages.filter((m: any) => {
                        if (seen.has(m.key.id)) return false;
                        seen.add(m.key.id);
                        return true;
                    });

                    // Update last message and timestamp
                    if (chats[sourceKey].timestamp > chats[targetKey].timestamp) {
                        chats[targetKey].timestamp = chats[sourceKey].timestamp;
                        chats[targetKey].lastMessage = chats[sourceKey].lastMessage;
                    }

                    delete chats[sourceKey];
                    io.emit('whatsapp:chat-deleted', { jid: sourceJid, chatKey: sourceKey });
                    io.emit('whatsapp:chat-updated', chats[targetKey]);
                    return; // Done merging
                } else if (chats[chatKey1] && !chats[chatKey2]) {
                    // If we only have the LID chat, we should probably rename it to PN chat if we know the PN
                    // but wait, if we only have one, it's fine. The issue is when we have TWO.
                    // However, renaming LID to PN helps prevent the "second" one from being created as PN later.
                    const isJid1Lid = key.includes('@lid');
                    if (isJid1Lid) {
                        chats[chatKey2] = { ...chats[chatKey1], id: jid2, key: chatKey2 };
                        delete chats[chatKey1];
                        io.emit('whatsapp:chat-deleted', { jid: jid1, chatKey: chatKey1 });
                        io.emit('whatsapp:chat-updated', chats[chatKey2]);
                        return;
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error in mergeChatsIfNeeded:', e);
    }
}

const logger = pino({ 
  level: 'info',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  hooks: {
    logMethod(inputArgs, method, level) {
            if (inputArgs.length >= 1) {
                const stringified = JSON.stringify(inputArgs).toLowerCase();
                const suppressStrings = [
                    'bad mac',
                    'no matching sessions',
                    'failed to decrypt message',
                    'intentional logout',
                    'stream errored',
                    'stream errored out'
                ];
                
                if (suppressStrings.some(s => stringified.includes(s))) return;
            }
            return method.apply(this, inputArgs as [string, ...any[]]);
    }
  }
});

interface Session {
  id: string;
  sock: any;
  state?: any;
  qrCode: string | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr';
  userInfo: any;
}

const sessions: Record<string, Session> = {};
const chats: Record<string, any> = {};

const mediaDir = path.join(process.cwd(), 'public', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

const users: any[] = [
  { id: '1', name: 'Admin', email: 'admin@example.com', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: '2', name: 'Agent 1', email: 'agent1@example.com', password: bcrypt.hashSync('agent123', 10), role: 'agent' },
];

async function connectToWhatsApp(io: Server, sessionId: string) {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      sock: null,
      qrCode: null,
      status: 'connecting',
      userInfo: null
    };
  }

  sessions[sessionId].status = 'connecting';
  io.emit('whatsapp:session-status', { sessionId, status: 'connecting' });

  try {
    const authPath = `auth_info_baileys_${sessionId}`;
    const { state, saveCreds } = await makeMultiFileAuthState(authPath);
    sessions[sessionId].state = state;
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      printQRInTerminal: true,
      auth: state,
      logger,
      browser: ['WhatsApp Manager', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: 2000,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
            message.buttonsMessage ||
            message.templateMessage ||
            message.listMessage
        );
        if (requiresPatch) {
            message = {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadataVersion: 2,
                            deviceListMetadata: {},
                        },
                        ...message,
                    },
                },
            };
        }
        return message;
      },
      getMessage: async (key) => {
        if (!key.remoteJid) return undefined;
        let jid = jidNormalizedUser(key.remoteJid);
        
        if (jid.endsWith('@lid')) {
            try {
                const mapping = await state.keys.get('lid-mapping', [jid]);
                if (mapping && mapping[jid]) {
                    const data = mapping[jid];
                    let pn = typeof data === 'string' ? data : (data as any)?.pn;
                    if (pn) jid = jidNormalizedUser(pn);
                }
            } catch (e) {
                console.error('LID resolution failed in getMessage', e);
            }
        }

        jid = normalizeJid(jid);

        const chatKey = `${sessionId}--${jid}`;
        if (chats[chatKey]) {
            const msg = chats[chatKey].messages.find((m: any) => m.key.id === key.id);
            return msg?.message || undefined;
        }
        return undefined;
      },
    });

    sessions[sessionId].sock = sock;

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (!sessions[sessionId]) return;

      if (qr) {
        sessions[sessionId].qrCode = await QRCode.toDataURL(qr);
        sessions[sessionId].status = 'qr';
        io.emit('whatsapp:session-status', { sessionId, status: 'qr', qr: sessions[sessionId].qrCode });
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = (error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || error?.message === 'Intentional Logout';
        const shouldReconnect = !isLoggedOut;
        
        if (isLoggedOut) {
            console.log(`Session ${sessionId} logged out intentionally`);
            if (sessions[sessionId]) {
                sessions[sessionId].status = 'disconnected';
                io.emit('whatsapp:session-status', { sessionId, status: 'disconnected' });
            }
        } else {
            const errorMessage = (error as any)?.message || '';
            const isStreamError = errorMessage.includes('Stream Errored');
            const isBadMac = errorMessage.toLowerCase().includes('bad mac');

            if (isBadMac) {
                console.log(`Bad MAC detected for session ${sessionId}, clearing session folders to repair...`);
                try {
                    const authPath = `auth_info_baileys_${sessionId}`;
                    const sessionPath = path.join(process.cwd(), authPath, 'sessions');
                    const senderKeyPath = path.join(process.cwd(), authPath, 'sender-keys');
                    
                    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
                    if (fs.existsSync(senderKeyPath)) fs.rmSync(senderKeyPath, { recursive: true, force: true });
                    
                    console.log(`Session folders cleared for ${sessionId}. Reconnecting...`);
                } catch (e) {
                    console.error('Failed to clear session folders on Bad MAC', e);
                }
            }

            if (!isStreamError) {
                console.log(`Session ${sessionId} connection closed due to `, error, ', reconnecting ', shouldReconnect);
            }
            
            if (sessions[sessionId]) {
                sessions[sessionId].status = 'disconnected';
                io.emit('whatsapp:session-status', { sessionId, status: 'disconnected' });
            }
            
            if (shouldReconnect) {
              setTimeout(() => {
                if (sessions[sessionId]) connectToWhatsApp(io, sessionId);
              }, 2000);
            }
        }
      } else if (connection === 'open') {
        sessions[sessionId].status = 'connected';
        sessions[sessionId].qrCode = null;
        if (sock.user) {
          sessions[sessionId].userInfo = { ...sock.user, id: normalizeJid(sock.user.id) };
        }
        io.emit('whatsapp:session-status', { 
          sessionId, 
          status: 'connected', 
          user: sessions[sessionId].userInfo 
        });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Handle stream errors which often include Bad MAC or decryption issues
    sock.ev.on('stream-error', (err) => {
        const errorMessage = err?.message || '';
        console.error(`Stream error in session ${sessionId}:`, errorMessage);
        
        if (errorMessage.toLowerCase().includes('bad mac')) {
            console.log(`Bad MAC detected in stream for session ${sessionId}, clearing session folders...`);
            try {
                const authPath = `auth_info_baileys_${sessionId}`;
                const sessionPath = path.join(process.cwd(), authPath, 'sessions');
                const senderKeyPath = path.join(process.cwd(), authPath, 'sender-keys');
                
                if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
                if (fs.existsSync(senderKeyPath)) fs.rmSync(senderKeyPath, { recursive: true, force: true });
                
                // Force a reconnect
                sock.end(undefined);
            } catch (e) {
                console.error('Failed to clear session folders on stream Bad MAC', e);
            }
        }
    });

    sock.ev.on('chats.upsert', async (newChats) => {
        for (const chat of newChats) {
            if (!chat.id) continue;
            let jid = normalizeJid(chat.id);
            
            // Try to resolve LID to PN immediately if possible
            if (jid.includes('lid')) {
                try {
                    const mapping = await state.keys.get('lid-mapping', [jid]);
                    if (mapping && mapping[jid]) {
                        const data = mapping[jid];
                        let pn = typeof data === 'string' ? data : (data as any)?.pn;
                        if (pn) jid = normalizeJid(pn);
                    }
                } catch (e) {}
            }

            if (jid.includes('@broadcast') || jid === 'status@broadcast') continue;

            const chatKey = `${sessionId}--${jid}`;
            if (!chats[chatKey]) {
                chats[chatKey] = {
                    id: jid,
                    sessionId,
                    key: chatKey,
                    name: chat.name || jid.split('@')[0],
                    timestamp: Number(chat.conversationTimestamp) || Math.floor(Date.now() / 1000),
                    unreadCount: chat.unreadCount || 0,
                    messages: []
                };
            } else {
                if (chat.name) chats[chatKey].name = chat.name;
                if (chat.unreadCount) chats[chatKey].unreadCount = chat.unreadCount;
            }

            // Check if we need to merge after upserting
            await mergeChatsIfNeeded(sessionId, jid, state, io);
        }
    });

    sock.ev.on('chats.update', async (updates) => {
        for (const update of updates) {
            if (!update.id) continue;
            const jid = normalizeJid(update.id);
            const chatKey = `${sessionId}--${jid}`;
            if (chats[chatKey]) {
                if (update.name) chats[chatKey].name = update.name;
                if (update.unreadCount) chats[chatKey].unreadCount = update.unreadCount;
            }
            await mergeChatsIfNeeded(sessionId, jid, state, io);
        }
    });

    sock.ev.on('contacts.upsert', async (contacts) => {
        for (const contact of contacts) {
            if (contact.id) {
                await mergeChatsIfNeeded(sessionId, contact.id, state, io);
            }
        }
    });

    sock.ev.on('contacts.update', async (updates) => {
        for (const update of updates) {
            if (update.id) {
                await mergeChatsIfNeeded(sessionId, update.id, state, io);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          // Check for decryption failure or Bad MAC
          const isDecryptionFailure = msg.messageStubType === 1 || (msg.message && Object.keys(msg.message).length === 0);
          
          if (isDecryptionFailure) {
            const jid = msg.key.remoteJid;
            if (jid) {
                console.log(`Decryption failure detected for ${jid}, attempting session repair...`);
                try {
                    // Clear both session and sender-key to force a full re-negotiation
                    await state.keys.set({ 
                        'session': { [jid]: null },
                        'sender-key': { [jid]: null }
                    });
                    
                    // Also try to resync if it's a critical failure
                    if (sock.resyncMainAppState) {
                        await sock.resyncMainAppState();
                    }
                } catch (e) {
                    console.error('Failed to repair session', e);
                }
            }
          }

          let rawJid = msg.key.remoteJid;
          if (!rawJid) continue;
          
          let jid = jidNormalizedUser(rawJid);

          if (jid.endsWith('@lid')) {
            try {
                const mapping = await state.keys.get('lid-mapping', [jid]);
                if (mapping && mapping[jid]) {
                    const data = mapping[jid];
                    let pn = typeof data === 'string' ? data : (data as any)?.pn;
                    if (pn) jid = jidNormalizedUser(pn);
                }
            } catch (e) {
                console.error('LID resolution failed in messages.upsert', e);
            }
          }

          jid = normalizeJid(jid);

          const chatKey = `${sessionId}--${jid}`;
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 
                       (msg.message?.imageMessage ? '📷 Foto' : '') ||
                       (msg.message?.videoMessage ? '🎥 Vídeo' : '') ||
                       (msg.message?.audioMessage ? '🎤 Áudio' : '') ||
                       (msg.message?.documentMessage ? '📄 Documento' : '') || '';
          
          if (msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.videoMessage || msg.message?.audioMessage) {
            try {
              const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
              let extension = 'bin';
              let type = 'document';
              if (msg.message.imageMessage) { extension = 'jpeg'; type = 'image'; }
              else if (msg.message.videoMessage) { extension = 'mp4'; type = 'video'; }
              else if (msg.message.audioMessage) { extension = 'ogg'; type = 'audio'; }
              else if (msg.message.documentMessage) { extension = 'bin'; type = 'document'; }

              const fileName = `${msg.key.id}.${extension}`;
              const filePath = path.join(mediaDir, fileName);
              fs.writeFileSync(filePath, buffer);
              msg.mediaUrl = `/media/${fileName}`;
              msg.mediaType = type;
              msg.fileName = msg.message.documentMessage?.fileName;
            } catch (err) {
              console.error('Failed to download media:', err);
            }
          }

          if (!chats[chatKey]) {
            chats[chatKey] = {
              id: jid,
              sessionId: sessionId,
              key: chatKey,
              name: msg.pushName || jid.split('@')[0],
              timestamp: (msg.messageTimestamp as number) || Date.now() / 1000,
              unreadCount: 0,
              messages: []
            };
          }

          chats[chatKey].lastMessage = text;
          chats[chatKey].timestamp = (msg.messageTimestamp as number) || Date.now() / 1000;
          
          const msgExists = chats[chatKey].messages.some((existingMsg: any) => existingMsg.key.id === msg.key.id);
          if (!msgExists) {
            chats[chatKey].messages.push(msg);
            if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();
          }

          io.emit('whatsapp:message', { ...msg, sessionId, chatKey, key: { ...msg.key, remoteJid: jid } });
          await mergeChatsIfNeeded(sessionId, jid, state, io);
        }
      }
    });
  } catch (err) {
    console.error(`Failed to connect to WhatsApp session ${sessionId}:`, err);
    if (sessions[sessionId]) {
        sessions[sessionId].status = 'disconnected';
        io.emit('whatsapp:session-status', { sessionId, status: 'disconnected', error: 'Failed to connect' });
    }
  }
}

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  const io = new Server(server);

  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  expressApp.use(cookieParser());
  expressApp.use('/media', express.static(mediaDir));

  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  };

  expressApp.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: !dev, sameSite: 'lax' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  expressApp.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));
  expressApp.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

  expressApp.get('/api/connections', authenticate, (req: any, res) => {
    res.json(Object.values(sessions).map(s => ({ id: s.id, status: s.status, qrCode: s.qrCode, userInfo: s.userInfo })));
  });

  expressApp.post('/api/connections', authenticate, (req: any, res) => {
    const sessionId = Date.now().toString();
    connectToWhatsApp(io, sessionId);
    res.json({ success: true, sessionId });
  });

  expressApp.delete('/api/connections/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    if (sessions[id]) {
      try {
        if (sessions[id].sock) { await sessions[id].sock.logout(); sessions[id].sock.end(undefined); }
      } catch (e: any) { if (e?.message !== 'Intentional Logout') console.error('Error logging out', e); }
      delete sessions[id];
      const authPath = path.join(process.cwd(), `auth_info_baileys_${id}`);
      if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
      io.emit('whatsapp:session-removed', { sessionId: id });
      res.json({ success: true });
    } else res.status(404).json({ error: 'Session not found' });
  });

  expressApp.post('/api/connections/:id/repair', authenticate, async (req: any, res) => {
    const { id } = req.params;
    if (sessions[id]) {
      console.log(`Manual repair requested for session ${id}`);
      
      // 1. Stop current socket
      if (sessions[id].sock) {
        try {
          sessions[id].sock.end(undefined);
        } catch (e) {}
      }
      
      // 2. Clear session and sender-key folders for this specific session
      const authPath = `auth_info_baileys_${id}`;
      const sessionPath = path.join(process.cwd(), authPath, 'sessions');
      const senderKeyPath = path.join(process.cwd(), authPath, 'sender-keys');
      
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
      if (fs.existsSync(senderKeyPath)) fs.rmSync(senderKeyPath, { recursive: true, force: true });
      
      // 3. Reconnect
      setTimeout(() => {
        connectToWhatsApp(io, id);
      }, 1000);
      
      res.json({ success: true });
    } else res.status(404).json({ error: 'Session not found' });
  });

  expressApp.get('/api/whatsapp/status', authenticate, async (req: any, res) => {
    // Run a quick merge check for all chats to clean up duplicates
    const sessionList = Object.values(sessions);
    for (const session of sessionList) {
        if (session.state) {
            const chatKeys = Object.keys(chats).filter(k => k.startsWith(`${session.id}--`));
            for (const chatKey of chatKeys) {
                const jid = chatKey.split('--')[1];
                await mergeChatsIfNeeded(session.id, jid, session.state, io);
            }
        }
    }

    let filteredChats = chats;
    if (req.user.role !== 'admin') {
      filteredChats = Object.fromEntries(Object.entries(chats).filter(([_, chat]: [string, any]) => !chat.assignedTo || chat.assignedTo === req.user.id));
    }
    const mainSession = sessionList[0] || { status: 'disconnected', qrCode: null, userInfo: null };
    res.json({ status: mainSession.status, qr: mainSession.qrCode, user: mainSession.userInfo, chats: filteredChats });
  });

  expressApp.post('/api/whatsapp/send', authenticate, async (req: any, res) => {
    const { jid: rawJid, text, media, mediaType, fileName, mimeType, sessionId } = req.body;
    let jid = normalizeJid(rawJid);
    let targetSessionId = sessionId;
    if (!targetSessionId) {
        const chatKey = Object.keys(chats).find(k => k.endsWith(`--${jid}`));
        if (chatKey) targetSessionId = chats[chatKey].sessionId;
    }
    if (!targetSessionId) {
        const connectedSession = Object.values(sessions).find(s => s.status === 'connected');
        if (connectedSession) targetSessionId = connectedSession.id;
    }
    const session = sessions[targetSessionId];
    if (!session || !session.sock || session.status !== 'connected') return res.status(400).json({ error: 'WhatsApp não conectado' });
    const chatKey = `${targetSessionId}--${jid}`;
    try {
      let msgPayload: any = media && mediaType ? { [mediaType === 'image' ? 'image' : 'document']: Buffer.from(media.split(',')[1], 'base64'), caption: text, mimetype: mimeType, fileName } : { text: text || '' };
      const sentMsg = await session.sock.sendMessage(jid, msgPayload);
      if (chats[chatKey]) {
        chats[chatKey].lastMessage = text || (mediaType === 'image' ? '📷 Foto' : '📄 Documento');
        chats[chatKey].messages.push(sentMsg);
        if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();
      }
      io.emit('whatsapp:message', { ...sentMsg, sessionId: targetSessionId, chatKey });
      res.json(sentMsg);
    } catch (err) { res.status(500).json({ error: 'Falha ao enviar' }); }
  });

  expressApp.all(/.*/, (req, res) => handle(req, res, parse(req.url!, true)));

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    const files = fs.readdirSync(process.cwd());
    const authFolders = files.filter(f => f.startsWith('auth_info_baileys_'));
    if (authFolders.length === 0) connectToWhatsApp(io, 'default');
    else authFolders.forEach(folder => connectToWhatsApp(io, folder.replace('auth_info_baileys_', '')));
  });
});
