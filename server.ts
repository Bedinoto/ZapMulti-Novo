console.log('>>> SERVER STARTING UP...');

import 'dotenv/config';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Hardcoded Database URL for Hostinger - MUST BE BEFORE PRISMA IMPORT
// Using 193.203.175.236 instead of localhost for better compatibility in some environments
process.env.DATABASE_URL = "mysql://u801415719_zapnovo:+5mNmLbAjF@193.203.175.236:3306/u801415719_zapnovo";

import next from 'next';
import express from 'express';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import { uazapi } from './lib/uazapi';
import { db, pool } from './lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = Number(process.env.PORT) || 3000;
const UAZAPI_INSTANCE_NAME = process.env.UAZAPI_INSTANCE_NAME || 'default';
const UAZAPI_WEBHOOK_URL = process.env.UAZAPI_WEBHOOK_URL;

// Handle Next.js import for ESM
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

// Global error handlers to prevent crashes on EPIPE or other unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function normalizeJid(rawJid: string): string {
    if (!rawJid) return '';
    let jid = rawJid.toLowerCase();
    if (jid.includes(':')) jid = jid.split(':')[0] + (jid.includes('@') ? '@' + jid.split('@')[1] : '');
    if (!jid.includes('@')) jid += '@s.whatsapp.net';
    if (jid.endsWith('@c.us')) jid = jid.replace('@c.us', '@s.whatsapp.net');
    return jid;
}

function getPhoneNumberFromJid(jid: string): string {
    if (jid && jid.endsWith('@s.whatsapp.net')) {
        return jid.split('@')[0];
    }
    return '';
}

interface Session {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr';
  qrCode: string | null;
  userInfo: any;
}

const sessions: Record<string, Session> = {};
const chats: Record<string, any> = {};
const contacts: Record<string, any> = {};
const syncedSessions = new Set<string>();

function normalizeUazapiMessage(sentMsg: any, jid: string, text: string, mediaType?: string): any {
    const messageTimestamp = Math.floor((sentMsg.messageTimestamp || Date.now()) / (sentMsg.messageTimestamp > 1000000000000 ? 1000 : 1));
    
    return {
      key: {
        remoteJid: sentMsg.chatid || jid,
        fromMe: true,
        id: sentMsg.messageid || sentMsg.id,
      },
      message: mediaType ? {
        [mediaType === 'image' ? 'imageMessage' : 'documentMessage']: {
          caption: text,
        }
      } : {
        conversation: text,
      },
      messageTimestamp,
      status: 1,
      mediaUrl: sentMsg.content?.URL || sentMsg.mediaUrl,
      mediaType: mediaType,
      fileName: sentMsg.content?.fileName || sentMsg.fileName,
    };
}

async function updateUazapiStatus(io: Server) {
  try {
    const sessionId = UAZAPI_INSTANCE_NAME;
    console.log(`Updating status for session ${sessionId}...`);
    let status;
    try {
      status = await uazapi.getStatus();
      console.log(`Status for ${sessionId}:`, JSON.stringify(status));
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.warn(`Instance ${sessionId} not found (404). Attempting to create...`);
        try {
          const createRes = await uazapi.createInstance(sessionId, process.env.UAZAPI_INSTANCE_TOKEN || '');
          console.log(`Instance ${sessionId} created:`, JSON.stringify(createRes));
          status = await uazapi.getStatus();
        } catch (createErr: any) {
          console.error(`Failed to create instance ${sessionId}:`, createErr.response?.data || createErr.message);
          status = {
            instance: { status: 'disconnected', qrcode: null },
            status: { loggedIn: false }
          };
        }
      } else {
        throw err;
      }
    }
    
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id: sessionId,
        status: 'disconnected',
        qrCode: null,
        userInfo: null
      };
    }

    const oldStatus = sessions[sessionId].status;
    sessions[sessionId].status = status.instance.status === 'connected' ? 'connected' : (status.instance.qrcode ? 'qr' : 'disconnected');
    sessions[sessionId].qrCode = status.instance.qrcode || null;
    
    if (status.status.loggedIn && status.status.jid) {
      sessions[sessionId].userInfo = {
        id: normalizeJid(`${status.status.jid.user}@${status.status.jid.server}`),
        name: status.instance.profileName || status.instance.name
      };

      // Sync chats if connected and not yet synced in this session
      if (sessions[sessionId].status === 'connected' && !syncedSessions.has(sessionId)) {
        console.log(`Syncing chats for session ${sessionId}...`);
        try {
          const remoteChatsResponse = await uazapi.getChats();
          console.log(`Remote chats response for ${sessionId} (keys):`, Object.keys(remoteChatsResponse || {}));
          
          let remoteChats = [];
          if (Array.isArray(remoteChatsResponse)) {
            remoteChats = remoteChatsResponse;
          } else if (remoteChatsResponse && typeof remoteChatsResponse === 'object') {
            remoteChats = remoteChatsResponse.chats || remoteChatsResponse.data || remoteChatsResponse.instances || [];
          }
          
          if (Array.isArray(remoteChats)) {
            console.log(`Received ${remoteChats.length} chats from remote for session ${sessionId}`);
            for (const chat of remoteChats) {
              const targetJid = normalizeJid(chat.id || chat.jid || chat.remoteJid);
              if (!targetJid) continue;
              
              const chatKey = `${sessionId}--${targetJid}`;
              if (!chats[chatKey]) {
                const chatName = chat.name || chat.pushname || chat.pushName || chat.verifiedName || targetJid.split('@')[0];
                chats[chatKey] = {
                  id: targetJid,
                  sessionId,
                  key: chatKey,
                  name: chatName,
                  unreadCount: chat.unreadCount || chat.unread || 0,
                  timestamp: Math.floor(Date.now() / 1000),
                  messages: []
                };
                
                // Save to DB
                await db.chat.upsert({
                  where: { id: chatKey },
                  update: { name: chats[chatKey].name },
                  create: {
                    id: chatKey,
                    sessionId,
                    jid: targetJid,
                    name: chats[chatKey].name,
                    timestamp: new Date()
                  }
                }).catch(e => console.error('Error saving synced chat to DB:', e));
              }
            }
            syncedSessions.add(sessionId);
            console.log(`Synced ${Object.keys(chats).filter(k => k.startsWith(sessionId)).length} chats for session ${sessionId}.`);
            emitToRelevantUsers(io, 'whatsapp:chats-synced', { sessionId });
          } else {
            console.warn(`Could not find chats array in response for session ${sessionId}:`, JSON.stringify(remoteChatsResponse).substring(0, 200));
          }
        } catch (err) {
          console.error('Error syncing remote chats:', err);
        }
      }
    }

    if (oldStatus !== sessions[sessionId].status) {
      emitToRelevantUsers(io, 'whatsapp:session-status', { 
        sessionId, 
        status: sessions[sessionId].status,
        qr: sessions[sessionId].qrCode,
        user: sessions[sessionId].userInfo
      });
    }
  } catch (error) {
    console.error('Error updating uazapi status:', error);
  }
}

function emitToRelevantUsers(io: Server, event: string, data: any) {
    if (event === 'whatsapp:message' || event === 'whatsapp:chat-updated' || event === 'whatsapp:chat-deleted') {
        let assignedTo = data.assignedTo;
        
        if (!assignedTo && data.chatKey && chats[data.chatKey]) {
            assignedTo = chats[data.chatKey].assignedTo;
        }
        
        io.to('admins').emit(event, data);
        if (assignedTo) {
            io.to(`user_${assignedTo}`).emit(event, data);
        } else {
            io.to('agents').emit(event, data);
        }
    } else if (event.startsWith('whatsapp:session')) {
        io.to('admins').emit(event, data);
    } else {
        io.emit(event, data);
    }
}

async function syncFromDb() {
    console.log('Syncing data from database...');
    try {
        const dbContacts = await db.contact.findMany();
        for (const c of dbContacts) {
            contacts[c.id] = {
                ...c,
                lastInteraction: c.lastInteraction ? new Date(c.lastInteraction).getTime() : Date.now()
            };
        }

        const dbChats = await db.chat.findMany();
        for (const c of dbChats) {
            const chatKey = c.id;
            const dbMessages = await db.message.findMany({
                where: { chatId: chatKey },
                orderBy: { timestamp: 'asc' },
                take: 50
            });
            chats[chatKey] = {
                id: c.jid,
                sessionId: c.sessionId,
                key: chatKey,
                name: c.name,
                unreadCount: c.unreadCount,
                timestamp: Math.floor(new Date(c.timestamp).getTime() / 1000),
                assignedTo: c.assignedTo,
                assignedToName: c.assignedToName,
                lastMessage: dbMessages.length > 0 ? (dbMessages[dbMessages.length - 1].text || (dbMessages[dbMessages.length - 1].mediaType === 'image' ? '📷 Foto' : '📄 Documento')) : '',
                messages: dbMessages.map(m => ({
                    key: { id: m.id, remoteJid: m.jid, fromMe: m.fromMe === 1 || m.fromMe === true },
                    message: m.text ? { conversation: m.text } : {},
                    messageTimestamp: m.messageTimestamp,
                    status: m.status,
                    mediaUrl: m.mediaUrl,
                    mediaType: m.mediaType,
                    fileName: m.fileName,
                    quotedMessageId: m.quotedMessageId,
                    quotedMessageText: m.quotedMessageText
                }))
            };
        }
        console.log(`Synced ${dbContacts.length} contacts and ${dbChats.length} chats.`);
    } catch (e) {
        console.error('Failed to sync from DB:', e);
    }
}

// No local media storage needed for cloud-based UAZAPI
// All media URLs are served directly from WhatsApp/UAZAPI

async function connectToWhatsApp(io: Server, sessionId: string) {
  try {
    await updateUazapiStatus(io);
    
    // Automatically update webhook if URL is provided
    if (UAZAPI_WEBHOOK_URL) {
      console.log(`Setting webhook to ${UAZAPI_WEBHOOK_URL}...`);
      try {
        await uazapi.updateWebhook(UAZAPI_WEBHOOK_URL);
        console.log('✔ Webhook updated successfully');
      } catch (webhookErr: any) {
        console.error('Failed to update webhook:', webhookErr.response?.data || webhookErr.message);
      }
    }

    // If disconnected, try to connect to get QR or start session
    if (sessions[sessionId]?.status === 'disconnected') {
      await uazapi.connect();
      await updateUazapiStatus(io);
    }
  } catch (error) {
    console.error('Error connecting to uazapi:', error);
  }
}

async function handleUazapiWebhook(io: Server, payload: any) {
  const { event, instance, data } = payload;
  const sessionId = instance || payload.instanceName || payload.instance_name || UAZAPI_INSTANCE_NAME;

  // Detailed logging to console for debugging
  console.log(`[${new Date().toISOString()}] Webhook: ${event} | Session: ${sessionId} | Payload: ${JSON.stringify(payload)}`);

  console.log(`Webhook received: ${event} for session ${sessionId}`);

  if (event === 'connection' || event === 'connection.update') {
    await updateUazapiStatus(io);
  } else if (event === 'messages' || event === 'messages.upsert' || event === 'messages.set') {
    const messages = Array.isArray(data) ? data : (data?.messages || [data]);
    console.log(`Processing ${messages.length} messages from event ${event} for session ${sessionId}`);
    
    for (const msg of messages) {
      if (!msg || !msg.key) continue;

      const rawJid = msg.key.remoteJid;
      if (!rawJid || rawJid === 'status@broadcast' || rawJid.includes('@broadcast')) continue;

      const targetJid = normalizeJid(rawJid);
      const chatKey = `${sessionId}--${targetJid}`;

      // Basic message info
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || (msg.message?.imageMessage ? '📷 Foto' : '') || (msg.message?.videoMessage ? '🎥 Vídeo' : '') || (msg.message?.audioMessage ? '🎤 Áudio' : '') || (msg.message?.documentMessage ? '📄 Documento' : '') || '';
      const timestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000);

      // Upsert Contact
      if (!contacts[targetJid]) {
        contacts[targetJid] = {
          id: targetJid,
          name: msg.pushName || msg.pushname || targetJid.split('@')[0],
          phoneNumber: getPhoneNumberFromJid(targetJid),
          lastInteraction: Date.now(),
          source: 'automatic'
        };
        await db.contact.upsert({
          where: { id: targetJid },
          update: { lastInteraction: new Date() },
          create: {
            id: targetJid,
            name: contacts[targetJid].name,
            phoneNumber: contacts[targetJid].phoneNumber,
            lastInteraction: new Date(),
            source: 'automatic'
          }
        }).catch(e => {
          console.error(`[${new Date().toISOString()}] ERROR saving contact ${targetJid}: ${e.message}`);
          console.error('Error saving contact to DB:', e);
        });
        emitToRelevantUsers(io, 'whatsapp:contact-new', contacts[targetJid]);
      }

      // Upsert Chat
      if (!chats[chatKey]) {
        chats[chatKey] = {
          id: targetJid,
          sessionId,
          key: chatKey,
          name: contacts[targetJid].name,
          timestamp,
          unreadCount: 0,
          messages: []
        };
        await db.chat.upsert({
          where: { id: chatKey },
          update: { timestamp: new Date() },
          create: {
            id: chatKey,
            sessionId,
            jid: targetJid,
            name: chats[chatKey].name,
            timestamp: new Date()
          }
        }).catch(e => {
          console.error(`[${new Date().toISOString()}] ERROR saving chat ${chatKey}: ${e.message}`);
          console.error('Error saving chat to DB:', e);
        });
      }

      chats[chatKey].lastMessage = text;
      chats[chatKey].timestamp = timestamp;

      // Save Message
      await db.message.upsert({
        where: { id: msg.key.id },
        update: { status: msg.status || 0 },
        create: {
          id: msg.key.id,
          chatId: chatKey,
          jid: targetJid,
          fromMe: msg.key.fromMe || false,
          text: text,
          messageTimestamp: timestamp,
          timestamp: new Date(timestamp * 1000),
          status: msg.status || 0,
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType,
          fileName: msg.fileName
        }
      }).catch(e => {
        console.error(`[${new Date().toISOString()}] ERROR saving message ${msg.key.id}: ${e.message}`);
        console.error('Error saving message to DB:', e);
      });

      // Add to in-memory messages if not exists
      const msgExists = chats[chatKey].messages.some((m: any) => m.key.id === msg.key.id);
      if (!msgExists) {
        chats[chatKey].messages.push(msg);
        if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();
      }

      emitToRelevantUsers(io, 'whatsapp:message', { ...msg, sessionId, chatKey });
    }
  } else if (event === 'chats.set' || event === 'chats.upsert') {
    // Handle bulk chat sync if provided by webhook
    const remoteChats = Array.isArray(data) ? data : (data?.chats || []);
    console.log(`Bulk syncing ${remoteChats.length} chats from webhook...`);
    for (const chat of remoteChats) {
      const targetJid = normalizeJid(chat.id || chat.jid);
      if (!targetJid) continue;
      const chatKey = `${sessionId}--${targetJid}`;
      if (!chats[chatKey]) {
        chats[chatKey] = {
          id: targetJid,
          sessionId,
          key: chatKey,
          name: chat.name || chat.pushname || chat.pushName || targetJid.split('@')[0],
          unreadCount: chat.unreadCount || 0,
          timestamp: Math.floor(Date.now() / 1000),
          messages: []
        };
        await db.chat.upsert({
          where: { id: chatKey },
          update: { name: chats[chatKey].name },
          create: {
            id: chatKey,
            sessionId,
            jid: targetJid,
            name: chats[chatKey].name,
            timestamp: new Date()
          }
        }).catch(e => console.error('Error saving chat from webhook to DB:', e));
      }
    }
    emitToRelevantUsers(io, 'whatsapp:chats-synced', { sessionId });
  }
}

let isNextReady = false;

nextApp.prepare().then(async () => {
  isNextReady = true;
  console.log('✔ Next.js is ready');
}).catch((err: any) => {
  console.error('✘ Failed to prepare Next.js:', err);
});

const expressApp = express();

// Request logger - MUST be first
expressApp.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
expressApp.get('/health-check', (req, res) => {
  console.log(`[HEALTH] Request from ${req.ip}, isNextReady: ${isNextReady}`);
  res.json({ status: 'ok', time: new Date().toISOString(), nextReady: isNextReady, version: '1.1.0' });
});

const server = createServer(expressApp);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware to check if Next.js is ready
expressApp.use((req, res, next) => {
  if (!isNextReady && !req.path.startsWith('/api')) {
    console.log(`[STARTUP] Blocking request to ${req.path} - Next.js not ready`);
    res.status(503).send('Application is starting, please wait...');
    return;
  }
  next();
});

  io.use((socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = cookies.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (user.role === 'admin') {
      socket.join('admins');
    } else {
      socket.join('agents');
    }
    socket.join(`user_${user.id}`);
    console.log(`User ${user.name} (${user.role}) connected to socket`);
  });

  // Test Database Connection
  pool.getConnection()
    .then(conn => {
      console.log('✔ Database connected successfully');
      conn.release();
    })
    .catch(err => {
      console.error('✘ Database connection failed!');
      console.error('Error details:', err instanceof Error ? err.message : err);
    });

  syncFromDb();

  expressApp.use(express.json({ limit: '50mb' }));
  expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));
  expressApp.use(cookieParser());
  // expressApp.use('/media', express.static(mediaDir));

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

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    next();
  };

  expressApp.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[LOGIN] Attempt for email: ${email}`);
    try {
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos' });
      }
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: isProd, // True in production (HTTPS)
        sameSite: isProd ? 'none' : 'lax',
        path: '/'
      });
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (err: any) {
      console.error('Login error:', err);
      // Check if it's a connection error
      const isConnError = err.code === 'ECONNREFUSED' || err.message.includes('Can\'t reach database');
      res.status(500).json({ 
        error: isConnError 
          ? 'Erro de comunicação com o banco de dados. Verifique se o Host, Usuário e Senha do MySQL estão corretos.' 
          : 'Erro interno no servidor ao tentar fazer login.' 
      });
    }
  });

  expressApp.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));
  expressApp.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

  // User Management
  expressApp.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const dbUsers = await db.user.findMany();
    res.json(dbUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })));
  });

  expressApp.post('/api/users', authenticate, isAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'E-mail já cadastrado' });
    
    const newUser = await db.user.create({
        data: {
            name,
            email,
            password: bcrypt.hashSync(password, 10),
            role
        }
    });
    res.json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
  });

  expressApp.put('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    
    try {
        const updatedUser = await db.user.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(role && { role }),
                ...(password && { password: bcrypt.hashSync(password, 10) })
            }
        });
        res.json(updatedUser);
    } catch (e) {
        res.status(404).json({ error: 'Usuário não encontrado' });
    }
  });

  expressApp.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === (req as any).user.id) return res.status(400).json({ error: 'Você não pode excluir a si mesmo' });
    
    try {
        await db.user.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(404).json({ error: 'Usuário não encontrado' });
    }
  });

  expressApp.get('/api/connections', authenticate, (req: any, res) => {
    res.json(Object.values(sessions).map(s => ({ id: s.id, status: s.status, qrCode: s.qrCode, userInfo: s.userInfo })));
  });

  expressApp.post('/api/uazapi/webhook', async (req, res) => {
    console.log(`Webhook route hit: ${req.method} ${req.url}`);
    try {
      await handleUazapiWebhook(io, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling uazapi webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  expressApp.get('/api/contacts', authenticate, (req, res) => {
    res.json(Object.values(contacts).sort((a, b) => b.lastInteraction - a.lastInteraction));
  });

  expressApp.post('/api/contacts', authenticate, async (req, res) => {
    const { name, phoneNumber } = req.body;
    if (!name || !phoneNumber) return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    
    if (contacts[jid]) return res.status(400).json({ error: 'Contato já existe' });
    
    contacts[jid] = {
      id: jid,
      name,
      phoneNumber: cleanPhone,
      lastInteraction: Date.now(),
      source: 'manual'
    };

    // DB Save
    await db.contact.create({
        data: {
            id: jid,
            name,
            phoneNumber: cleanPhone,
            lastInteraction: new Date(),
            source: 'manual'
        }
    });
    
    emitToRelevantUsers(io, 'whatsapp:contact-new', contacts[jid]);
    res.json(contacts[jid]);
  });

  expressApp.put('/api/contacts/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    
    if (!contacts[id]) return res.status(404).json({ error: 'Contato não encontrado' });
    
    contacts[id].name = name;
    
    // DB Update
    await db.contact.update({
        where: { id },
        data: { name }
    });
    
    // Update name in all chats of this contact
    for (const chatKey in chats) {
        if (chats[chatKey].id === id) {
            chats[chatKey].name = name;
            await db.chat.update({
                where: { id: chatKey },
                data: { name }
            });
            emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[chatKey]);
        }
    }
    
    emitToRelevantUsers(io, 'whatsapp:contact-updated', contacts[id]);
    res.json(contacts[id]);
  });

  expressApp.delete('/api/contacts/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    if (!contacts[id]) return res.status(404).json({ error: 'Contato não encontrado' });
    
    delete contacts[id];
    
    // DB Delete
    await db.contact.delete({ where: { id } });
    
    emitToRelevantUsers(io, 'whatsapp:contact-deleted', { jid: id });
    res.json({ success: true });
  });

  expressApp.post('/api/contacts/:id/chat', authenticate, async (req, res) => {
    const { id } = req.params;
    if (!contacts[id]) return res.status(404).json({ error: 'Contato não encontrado' });
    
    // Find a connected session
    const activeSession = Object.values(sessions).find(s => s.status === 'connected');
    if (!activeSession) return res.status(400).json({ error: 'Nenhuma conexão WhatsApp ativa' });
    
    const chatKey = `${activeSession.id}--${id}`;
    
    if (!chats[chatKey]) {
        chats[chatKey] = {
            id: id,
            key: chatKey,
            sessionId: activeSession.id,
            name: contacts[id].name,
            unreadCount: 0,
            timestamp: Date.now(),
            messages: []
        };
        
        // DB Save
        await db.chat.upsert({
            where: { id: chatKey },
            update: { name: contacts[id].name },
            create: {
                id: chatKey,
                sessionId: activeSession.id,
                jid: id,
                name: contacts[id].name,
                timestamp: new Date()
            }
        });
        
        emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[chatKey]);
    }
    
    res.json({ chatKey });
  });

  expressApp.post('/api/whatsapp/chats/:chatKey/accept', authenticate, async (req: any, res) => {
    const { chatKey } = req.params;
    if (!chats[chatKey]) return res.status(404).json({ error: 'Conversa não encontrada' });
    
    chats[chatKey].assignedTo = req.user.id;
    chats[chatKey].assignedToName = req.user.name;

    // DB Update
    await db.chat.update({
        where: { id: chatKey },
        data: {
            assignedTo: req.user.id,
            assignedToName: req.user.name
        }
    });
    
    emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[chatKey]);
    res.json(chats[chatKey]);
  });

  expressApp.post('/api/whatsapp/chats/:chatKey/reject', authenticate, async (req: any, res) => {
    const { chatKey } = req.params;
    if (!chats[chatKey]) return res.status(404).json({ error: 'Conversa não encontrada' });
    
    chats[chatKey].assignedTo = null;
    chats[chatKey].assignedToName = null;

    // DB Update
    await db.chat.update({
        where: { id: chatKey },
        data: {
            assignedTo: null,
            assignedToName: null
        }
    });
    
    emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[chatKey]);
    res.json(chats[chatKey]);
  });

  expressApp.delete('/api/whatsapp/chats/:chatKey', authenticate, async (req: any, res) => {
    const { chatKey } = req.params;
    if (!chats[chatKey]) return res.status(404).json({ error: 'Conversa não encontrada' });
    
    if (req.user.role !== 'admin' && chats[chatKey].assignedTo !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    delete chats[chatKey];
    
    // DB Delete
    await db.chat.delete({ where: { id: chatKey } });

    emitToRelevantUsers(io, 'whatsapp:chat-deleted', { chatKey });
    res.json({ success: true });
  });

  expressApp.post('/api/connections', authenticate, (req: any, res) => {
    connectToWhatsApp(io, UAZAPI_INSTANCE_NAME);
    res.json({ success: true, sessionId: UAZAPI_INSTANCE_NAME });
  });

  expressApp.delete('/api/connections/:id', authenticate, async (req: any, res) => {
    const { id } = req.params;
    if (sessions[id]) {
      try {
        await uazapi.logout();
        await updateUazapiStatus(io);
      } catch (e: any) { console.error('Error logging out', e); }
      delete sessions[id];
      emitToRelevantUsers(io, 'whatsapp:session-removed', { sessionId: id });
      res.json({ success: true });
    } else res.status(404).json({ error: 'Session not found' });
  });

  expressApp.post('/api/connections/:id/repair', authenticate, async (req: any, res) => {
    const { id } = req.params;
    if (sessions[id]) {
      console.log(`Manual repair requested for session ${id}`);
      
      try {
        await uazapi.connect();
        await updateUazapiStatus(io);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Falha ao reparar conexão' });
      }
    } else res.status(404).json({ error: 'Session not found' });
  });

  expressApp.get('/api/whatsapp/status', authenticate, async (req: any, res) => {
    await updateUazapiStatus(io);

    let filteredChats = chats;
    if (req.user.role !== 'admin') {
      filteredChats = Object.fromEntries(Object.entries(chats).filter(([_, chat]: [string, any]) => !chat.assignedTo || chat.assignedTo === req.user.id));
    }
    const mainSession = sessions[UAZAPI_INSTANCE_NAME] || { status: 'disconnected', qrCode: null, userInfo: null };
    res.json({ status: mainSession.status, qr: mainSession.qrCode, user: mainSession.userInfo, chats: filteredChats });
  });

  expressApp.post('/api/whatsapp/send', authenticate, async (req: any, res) => {
    const { jid: rawJid, text, media, mediaType, fileName, mimeType, sessionId, quotedMessageId } = req.body;
    let jid = normalizeJid(rawJid);
    let targetSessionId = sessionId || UAZAPI_INSTANCE_NAME;
    
    const session = sessions[targetSessionId];
    if (!session || session.status !== 'connected') return res.status(400).json({ error: 'WhatsApp não conectado' });
    const chatKey = `${targetSessionId}--${jid}`;
    const userName = req.user.name || 'Atendente';
    const finalMessage = text ? `*${userName}*\n${text}` : '';

    try {
      let sentMsg: any;
      if (media && mediaType) {
        sentMsg = await uazapi.sendMedia(jid, media, mediaType === 'image' ? 'image' : 'document', finalMessage, fileName, mimeType);
      } else {
        sentMsg = await uazapi.sendText(jid, finalMessage || '');
      }

      const normalizedMsg = normalizeUazapiMessage(sentMsg, jid, finalMessage, mediaType);

      if (chats[chatKey]) {
        chats[chatKey].lastMessage = finalMessage || (mediaType === 'image' ? '📷 Foto' : '📄 Documento');
        chats[chatKey].timestamp = normalizedMsg.messageTimestamp;
        
        const msgExists = chats[chatKey].messages.some((m: any) => m.key.id === normalizedMsg.key.id);
        if (!msgExists) {
          chats[chatKey].messages.push(normalizedMsg);
          if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();
        }
      }

      // Save Message to DB
      await db.message.upsert({
        where: { id: normalizedMsg.key.id },
        update: { status: normalizedMsg.status || 0 },
        create: {
          id: normalizedMsg.key.id,
          chatId: chatKey,
          jid: jid,
          fromMe: true,
          text: finalMessage,
          messageTimestamp: normalizedMsg.messageTimestamp,
          timestamp: new Date(normalizedMsg.messageTimestamp * 1000),
          status: normalizedMsg.status || 0,
          mediaUrl: normalizedMsg.mediaUrl,
          mediaType: normalizedMsg.mediaType,
          fileName: normalizedMsg.fileName
        }
      }).catch(err => console.error('Failed to save sent message to DB:', err));

      // Update DB timestamp
      await db.chat.update({
          where: { id: chatKey },
          data: { 
            timestamp: new Date(normalizedMsg.messageTimestamp * 1000)
          }
      }).catch(err => console.error('Failed to update chat timestamp in DB:', err));

      const emitMsg = { 
        ...normalizedMsg, 
        sessionId: targetSessionId, 
        chatKey,
        quotedMessageId,
      };

      emitToRelevantUsers(io, 'whatsapp:message', emitMsg);
      res.json(normalizedMsg);
    } catch (err) { res.status(500).json({ error: 'Falha ao enviar' }); }
  });

  expressApp.all(/.*/, (req, res) => {
    console.log(`[NEXT] Request: ${req.method} ${req.url}`);
    return handle(req, res, parse(req.url!, true));
  });

server.listen(port, () => {
  console.log(`> Server is listening on port ${port}`);
  console.log(`> Environment: ${process.env.NODE_ENV}`);
  console.log(`> Database URL set: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
  connectToWhatsApp(io, UAZAPI_INSTANCE_NAME);
});
