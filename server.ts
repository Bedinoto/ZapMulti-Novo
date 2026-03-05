import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import express from 'express';
import { Server } from 'socket.io';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState as makeMultiFileAuthState, 
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
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

const logger = pino({ level: 'info' });

console.log('Starting server initialization...');

// State for the WhatsApp connection
let sock: any = null;
let qrCode: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'qr' = 'disconnected';
let userInfo: any = null;

// In-memory store for chats and messages
const chats: Record<string, any> = {};

// Ensure media directory exists
const mediaDir = path.join(process.cwd(), 'public', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

// In-memory store for users (in a real app, use a database)
const users: any[] = [
  { id: '1', name: 'Admin', email: 'admin@example.com', password: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { id: '2', name: 'Agent 1', email: 'agent1@example.com', password: bcrypt.hashSync('agent123', 10), role: 'agent' },
];

async function connectToWhatsApp(io: Server) {
  console.log('Connecting to WhatsApp...');
  connectionStatus = 'connecting';
  io.emit('whatsapp:status', { status: 'connecting' });

  try {
    const { state, saveCreds } = await makeMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      printQRInTerminal: true,
      auth: state,
      logger,
      browser: ['WhatsApp Manager', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = await QRCode.toDataURL(qr);
        connectionStatus = 'qr';
        io.emit('whatsapp:status', { status: 'qr', qr: qrCode });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        connectionStatus = 'disconnected';
        io.emit('whatsapp:status', { status: 'disconnected' });
        if (shouldReconnect) {
          connectToWhatsApp(io);
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        connectionStatus = 'connected';
        qrCode = null;
        userInfo = { ...sock.user, id: jidNormalizedUser(sock.user.id) };
        io.emit('whatsapp:status', { status: 'connected', user: userInfo });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('lid-mapping.update', (mappings: any) => {
      for (const { lid, pn } of mappings) {
        const normalizedLid = jidNormalizedUser(lid);
        const normalizedPn = jidNormalizedUser(pn);
        
        console.log(`LID Mapping update: ${normalizedLid} <-> ${normalizedPn}`);
        
        if (chats[normalizedLid] && !chats[normalizedPn]) {
          chats[normalizedPn] = { ...chats[normalizedLid], id: normalizedPn };
          delete chats[normalizedLid];
          console.log(`Migrated chat from LID ${normalizedLid} to PN ${normalizedPn}`);
        } else if (chats[normalizedLid] && chats[normalizedPn]) {
          const combinedMessages = [...chats[normalizedPn].messages, ...chats[normalizedLid].messages]
            .sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0))
            .filter((msg, index, self) => 
              index === self.findIndex((m) => m.key.id === msg.key.id)
            );
          
          chats[normalizedPn].messages = combinedMessages;
          delete chats[normalizedLid];
          console.log(`Merged LID chat ${normalizedLid} into PN chat ${normalizedPn}`);
        }
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          let rawJid = msg.key.remoteJid;
          if (!rawJid) continue;
          
          if (rawJid.includes('@lid') && sock?.signalRepository?.lidMapping) {
            try {
              const mappedPn = await sock.signalRepository.lidMapping.getPNForLID(rawJid);
              if (mappedPn) {
                rawJid = mappedPn;
                msg.key.remoteJid = mappedPn;
              }
            } catch (err) {
              console.error('Error resolving LID to PN:', err);
            }
          }
          
          const jid = jidNormalizedUser(rawJid);
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 
                       (msg.message?.imageMessage ? '📷 Foto' : '') ||
                       (msg.message?.videoMessage ? '🎥 Vídeo' : '') ||
                       (msg.message?.audioMessage ? '🎤 Áudio' : '') ||
                       (msg.message?.documentMessage ? '📄 Documento' : '') || '';
          
          // Handle Media
          if (msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.videoMessage || msg.message?.audioMessage) {
            try {
              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { 
                  logger,
                  reuploadRequest: sock.updateMediaMessage
                }
              );
              
              let extension = 'bin';
              let type = 'document';

              if (msg.message.imageMessage) {
                extension = 'jpeg';
                type = 'image';
              } else if (msg.message.videoMessage) {
                extension = 'mp4';
                type = 'video';
              } else if (msg.message.audioMessage) {
                extension = 'mp3'; // WhatsApp audio is usually ogg/mp4 but mp3 is safer for browser playback if converted, but raw file is usually ogg. Let's use ogg or mp3. Baileys downloads as is.
                // Actually, let's check mimetype.
                const mimetype = msg.message.audioMessage.mimetype;
                extension = mimetype.split(';')[0].split('/')[1] || 'ogg';
                // Common fix: WhatsApp sends ogg/opus. Browsers play ogg.
                if (extension === 'mpeg') extension = 'mp3';
                type = 'audio';
              } else if (msg.message.documentMessage) {
                extension = msg.message.documentMessage.mimetype.split('/')[1] || 'bin';
                type = 'document';
              }

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

          if (!chats[jid]) {
            chats[jid] = {
              id: jid,
              name: msg.pushName || jid.split('@')[0],
              timestamp: msg.messageTimestamp,
              unreadCount: 0,
              messages: []
            };
          }

          chats[jid].lastMessage = text;
          chats[jid].timestamp = msg.messageTimestamp;
          
          const msgExists = chats[jid].messages.some((existingMsg: any) => existingMsg.key.id === msg.key.id);
          if (!msgExists) {
            chats[jid].messages.push(msg);
            if (chats[jid].messages.length > 50) {
              chats[jid].messages.shift();
            }
          }

          io.emit('whatsapp:message', msg);
        }
      }
    });
  } catch (err) {
    console.error('Failed to connect to WhatsApp:', err);
    connectionStatus = 'disconnected';
    io.emit('whatsapp:status', { status: 'disconnected', error: 'Failed to connect' });
  }
}

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  const io = new Server(server);

  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  expressApp.use(cookieParser());

  // Serve media files
  expressApp.use('/media', express.static(mediaDir));

  // Auth Middleware
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

  // Auth Routes
  expressApp.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: !dev, sameSite: 'lax' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  expressApp.get('/api/auth/me', authenticate, (req: any, res) => {
    res.json(req.user);
  });

  expressApp.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  // User Management Routes (Admin Only)
  expressApp.get('/api/users', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Proibido' });
    // Return users without passwords
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json(safeUsers);
  });

  expressApp.post('/api/users', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Proibido' });
    const { name, email, password, role } = req.body;
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email já existe' });
    }

    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: role || 'agent'
    };
    users.push(newUser);
    const { password: _, ...safeUser } = newUser;
    res.json(safeUser);
  });

  expressApp.put('/api/users/:id', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Proibido' });
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (email && email !== users[userIndex].email) {
      if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email já existe' });
      }
      users[userIndex].email = email;
    }

    if (name) users[userIndex].name = name;
    if (role) users[userIndex].role = role;
    if (password) users[userIndex].password = bcrypt.hashSync(password, 10);

    const { password: _, ...safeUser } = users[userIndex];
    res.json(safeUser);
  });

  expressApp.delete('/api/users/:id', authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Proibido' });
    const { id } = req.params;
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
    
    // Prevent deleting the last admin or yourself if needed, but for now just delete
    users.splice(userIndex, 1);
    res.json({ success: true });
  });

  // WhatsApp API Routes (Protected)
  expressApp.get('/api/whatsapp/status', authenticate, (req: any, res) => {
    // Enrich chats with assignedToName if missing (for existing data)
    Object.values(chats).forEach((chat: any) => {
      if (chat.assignedTo && !chat.assignedToName) {
        const user = users.find(u => u.id === chat.assignedTo);
        if (user) chat.assignedToName = user.name;
      }
    });

    let filteredChats = chats;
    if (req.user.role !== 'admin') {
      filteredChats = Object.fromEntries(
        Object.entries(chats).filter(([_, chat]: [string, any]) => 
          !chat.assignedTo || chat.assignedTo === req.user.id
        )
      );
    }
    res.json({ status: connectionStatus, qr: qrCode, user: userInfo, chats: filteredChats });
  });

  expressApp.post('/api/whatsapp/send', authenticate, async (req: any, res) => {
    const { jid: rawJid, text, media, mediaType, fileName, mimeType } = req.body;
    if (!sock || connectionStatus !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp não conectado' });
    }
    const jid = jidNormalizedUser(rawJid);
    
    // Check if chat is assigned to someone else
    if (chats[jid] && chats[jid].assignedTo && chats[jid].assignedTo !== req.user.id) {
      // Allow admins to send anyway, or restrict? Let's restrict for now.
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Conversa atribuída a outro agente' });
      }
    }

    try {
      let msgPayload: any = {};

      if (media && mediaType) {
        const buffer = Buffer.from(media.split(',')[1], 'base64');
        
        if (mediaType === 'image') {
          msgPayload = { 
            image: buffer, 
            caption: text 
          };
        } else if (mediaType === 'document') {
          msgPayload = { 
            document: buffer, 
            mimetype: mimeType || 'application/octet-stream',
            fileName: fileName || 'document',
            caption: text
          };
        }
      } else {
        msgPayload = { text: text || '' };
      }

      const sentMsg = await sock.sendMessage(jid, msgPayload);
      
      if (chats[jid]) {
        chats[jid].lastMessage = text || (mediaType === 'image' ? '📷 Foto' : '📄 Documento');
        chats[jid].messages.push(sentMsg);
        if (chats[jid].messages.length > 50) chats[jid].messages.shift();
        
        // Auto-assign if not assigned
        if (!chats[jid].assignedTo) {
          chats[jid].assignedTo = req.user.id;
          const assignedUser = users.find(u => u.id === req.user.id);
          chats[jid].assignedToName = assignedUser?.name;
          io.emit('whatsapp:chat-assigned', { jid, userId: req.user.id, userName: assignedUser?.name });
        }
      }
      io.emit('whatsapp:message', sentMsg);
      res.json(sentMsg);
    } catch (err) {
      console.error('Send error:', err);
      res.status(500).json({ error: 'Falha ao enviar mensagem' });
    }
  });

  expressApp.post('/api/whatsapp/chats/:jid/assign', authenticate, (req: any, res) => {
    const { jid } = req.params;
    const normalizedJid = jidNormalizedUser(jid);
    if (chats[normalizedJid]) {
      chats[normalizedJid].assignedTo = req.user.id;
      const assignedUser = users.find(u => u.id === req.user.id);
      chats[normalizedJid].assignedToName = assignedUser?.name;
      io.emit('whatsapp:chat-assigned', { jid: normalizedJid, userId: req.user.id, userName: assignedUser?.name });
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Conversa não encontrada' });
  });

  expressApp.delete('/api/whatsapp/chats/:jid', authenticate, (req, res) => {
    const { jid } = req.params;
    const normalizedJid = jidNormalizedUser(jid);
    if (chats[normalizedJid]) {
      delete chats[normalizedJid];
      io.emit('whatsapp:chat-deleted', { jid: normalizedJid });
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Conversa não encontrada' });
  });

  expressApp.get('/api/whatsapp/logout', async (req, res) => {
    try {
      if (sock) {
        await sock.logout();
        sock.end(undefined);
        sock = null;
      }
      const authPath = path.join(process.cwd(), 'auth_info_baileys');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
      connectionStatus = 'disconnected';
      qrCode = null;
      userInfo = null;
      Object.keys(chats).forEach(key => delete chats[key]);
      io.emit('whatsapp:status', { status: 'disconnected' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Falha ao sair' });
    }
  });

  expressApp.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    connectToWhatsApp(io);
  });
});
