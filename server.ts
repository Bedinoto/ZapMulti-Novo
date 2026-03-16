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
import * as cookie from 'cookie';
import { prisma } from './lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Handle Next.js import for ESM
const nextApp = (next as any).default || next;
const app = nextApp({ dev, hostname, port });
const handle = app.getRequestHandler();

// Global error handlers to prevent crashes on EPIPE or other unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

function normalizeJid(rawJid: string): string {
    if (!rawJid) return '';
    let jid = jidNormalizedUser(rawJid);
    if (jid.endsWith('@c.us')) jid = jid.replace('@c.us', '@s.whatsapp.net');
    return jid;
}

function getPhoneNumberFromJid(jid: string): string {
    if (jid && jid.endsWith('@s.whatsapp.net')) {
        return jid.split('@')[0];
    }
    return '';
}

async function resolvePn(jid: string, state: any): Promise<string | null> {
    if (!jid || !jid.endsWith('@lid')) return null;
    try {
        const mapping = await state.keys.get('lid-mapping', [jid]);
        if (mapping && mapping[jid]) {
            const data = mapping[jid];
            const pn = typeof data === 'string' ? data : (data as any)?.pn;
            return pn ? jidNormalizedUser(pn) : null;
        }
    } catch (e) {
        console.error('Error resolving PN:', e);
    }
    return null;
}

async function mergeChatsIfNeeded(sessionId: string, jid: string, state: any, io: Server) {
    if (!jid || jid === 'status@broadcast' || jid.includes('@broadcast')) return;
    
    try {
        // Baileys stores mappings both ways: PN -> LID and LID -> PN
        // We look up the provided JID to see if it has a corresponding other ID
        const mappings = await state.keys.get('lid-mapping', [jid]);
        
        if (mappings && mappings[jid]) {
            const value = mappings[jid];
            const otherJidRaw = typeof value === 'string' ? value : (value as any)?.pn || (value as any)?.lid;
            if (!otherJidRaw) return;

            const jid1 = normalizeJid(jid);
            const jid2 = normalizeJid(otherJidRaw);
            
            const chatKey1 = `${sessionId}--${jid1}`;
            const chatKey2 = `${sessionId}--${jid2}`;
            
            if (chatKey1 === chatKey2) return;

            // Determine which one is LID and which is PN
            const isJid1Lid = jid1.includes('@lid');
            const lidKey = isJid1Lid ? chatKey1 : chatKey2;
            const pnKey = isJid1Lid ? chatKey2 : chatKey1;
            const lidJid = isJid1Lid ? jid1 : jid2;
            const pnJid = isJid1Lid ? jid2 : jid1;

            // Case 1: Both chats exist, merge them
            if (chats[lidKey] && chats[pnKey]) {
                console.log(`Merging LID chat ${lidKey} into PN chat ${pnKey}`);
                
                // Merge messages
                const mergedMessages = [
                    ...chats[pnKey].messages,
                    ...chats[lidKey].messages
                ].sort((a, b) => (a.messageTimestamp as number) - (b.messageTimestamp as number));
                
                // Deduplicate
                const seen = new Set();
                chats[pnKey].messages = mergedMessages.filter((m: any) => {
                    if (seen.has(m.key.id)) return false;
                    seen.add(m.key.id);
                    return true;
                });

                // Update last message and timestamp if LID has newer info
                if (chats[lidKey].timestamp > chats[pnKey].timestamp) {
                    chats[pnKey].timestamp = chats[lidKey].timestamp;
                    chats[pnKey].lastMessage = chats[lidKey].lastMessage;
                }

                // Delete the LID chat and notify clients
                delete chats[lidKey];
                
                // DB Update
                await prisma.chat.deleteMany({ where: { id: lidKey } });
                await prisma.message.updateMany({
                    where: { chatId: lidKey },
                    data: { chatId: pnKey }
                });

                emitToRelevantUsers(io, 'whatsapp:chat-deleted', { jid: lidJid, chatKey: lidKey });
                emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[pnKey]);
            } 
            // Case 2: Only LID chat exists, rename it to PN
            else if (chats[lidKey] && !chats[pnKey]) {
                console.log(`Renaming LID chat ${lidKey} to PN chat ${pnKey}`);
                chats[pnKey] = { ...chats[lidKey], id: pnJid, key: pnKey };
                delete chats[lidKey];

                // DB Update
                await prisma.chat.update({
                    where: { id: lidKey },
                    data: { id: pnKey, jid: pnJid }
                });

                emitToRelevantUsers(io, 'whatsapp:chat-deleted', { jid: lidJid, chatKey: lidKey });
                emitToRelevantUsers(io, 'whatsapp:chat-updated', chats[pnKey]);
            }

            // --- Contact Merging ---
            if (contacts[lidJid] && contacts[pnJid]) {
                console.log(`Merging LID contact ${lidJid} into PN contact ${pnJid}`);
                if (contacts[lidJid].lastInteraction > contacts[pnJid].lastInteraction) {
                    contacts[pnJid].lastInteraction = contacts[lidJid].lastInteraction;
                }
                // Keep the best name
                if (contacts[lidJid].name && contacts[lidJid].name !== lidJid.split('@')[0]) {
                    if (!contacts[pnJid].name || contacts[pnJid].name === pnJid.split('@')[0]) {
                        contacts[pnJid].name = contacts[lidJid].name;
                    }
                }
                delete contacts[lidJid];

                // DB Update
                await prisma.contact.delete({ where: { id: lidJid } });
                await prisma.contact.update({
                    where: { id: pnJid },
                    data: {
                        name: contacts[pnJid].name,
                        lastInteraction: new Date(contacts[pnJid].lastInteraction)
                    }
                });

                emitToRelevantUsers(io, 'whatsapp:contact-deleted', { jid: lidJid });
                emitToRelevantUsers(io, 'whatsapp:contact-updated', contacts[pnJid]);
            } else if (contacts[lidJid] && !contacts[pnJid]) {
                console.log(`Renaming LID contact ${lidJid} to PN contact ${pnJid}`);
                contacts[pnJid] = { ...contacts[lidJid], id: pnJid, phoneNumber: pnJid.split('@')[0] };
                delete contacts[lidJid];

                // DB Update
                await prisma.contact.update({
                    where: { id: lidJid },
                    data: { id: pnJid, phoneNumber: pnJid.split('@')[0] }
                });

                emitToRelevantUsers(io, 'whatsapp:contact-deleted', { jid: lidJid });
                emitToRelevantUsers(io, 'whatsapp:contact-new', contacts[pnJid]);
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
                    'stream errored out',
                    'qr refs attempts ended'
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
const contacts: Record<string, any> = {};

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
        const dbContacts = await prisma.contact.findMany();
        for (const c of dbContacts) {
            contacts[c.id] = {
                ...c,
                lastInteraction: c.lastInteraction.getTime()
            };
        }

        const dbChats = await prisma.chat.findMany({
            include: {
                messages: {
                    orderBy: { messageTimestamp: 'asc' },
                    take: 50
                }
            }
        });
        for (const c of dbChats) {
            const chatKey = c.id;
            chats[chatKey] = {
                id: c.jid,
                key: chatKey,
                name: c.name,
                unreadCount: c.unreadCount,
                timestamp: c.timestamp.getTime(),
                assignedTo: c.assignedTo,
                assignedToName: c.assignedToName,
                messages: c.messages.map(m => ({
                    key: { id: m.id, remoteJid: m.jid, fromMe: m.fromMe },
                    message: m.text ? { conversation: m.text } : {},
                    messageTimestamp: m.messageTimestamp,
                    status: m.status
                }))
            };
        }
        console.log(`Synced ${dbContacts.length} contacts and ${dbChats.length} chats.`);
    } catch (e) {
        console.error('Failed to sync from DB:', e);
    }
}

const mediaDir = path.join(process.cwd(), 'public', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}

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
  emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'connecting' });

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
        emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'qr', qr: sessions[sessionId].qrCode });
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = (error as Boom)?.output?.statusCode;
        const errorMessage = (error as any)?.message || '';
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || errorMessage === 'Intentional Logout';
        const isQrExpired = errorMessage.includes('QR refs attempts ended');
        const shouldReconnect = !isLoggedOut;
        
        if (isLoggedOut) {
            console.log(`Session ${sessionId} logged out intentionally`);
            if (sessions[sessionId]) {
                sessions[sessionId].status = 'disconnected';
                emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'disconnected' });
            }
        } else {
            if (isQrExpired) {
                console.log(`Session ${sessionId} QR code expired (attempts ended)`);
                if (sessions[sessionId]) {
                    sessions[sessionId].qrCode = null;
                    emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'disconnected', error: 'QR_EXPIRED' });
                }
            }

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

            if (!isStreamError && !isQrExpired) {
                console.log(`Session ${sessionId} connection closed due to `, error, ', reconnecting ', shouldReconnect);
            }
            
            if (sessions[sessionId]) {
                sessions[sessionId].status = 'disconnected';
                emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'disconnected' });
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
        emitToRelevantUsers(io, 'whatsapp:session-status', { 
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

    sock.ev.on('contacts.upsert', async (newContacts) => {
        for (const contact of newContacts) {
            let jid = normalizeJid(contact.id);
            if (!jid || jid === 'status@broadcast' || jid.includes('@broadcast') || jid.includes('@g.us')) continue;
            
            let pnJid = jid.endsWith('@s.whatsapp.net') ? jid : null;
                
                // Try to resolve PN for LID contacts
                if (jid.endsWith('@lid')) {
                    const resolvedPn = await resolvePn(jid, state);
                    if (resolvedPn) pnJid = normalizeJid(resolvedPn);
                }

                const targetJid = pnJid || jid;
                const phoneNumber = getPhoneNumberFromJid(pnJid || '');

                if (!contacts[targetJid]) {
                    contacts[targetJid] = {
                        id: targetJid,
                        name: contact.name || contact.notify || contact.verifiedName || (phoneNumber || targetJid.split('@')[0]),
                        phoneNumber: phoneNumber,
                        lastInteraction: Date.now(),
                        source: 'automatic'
                    };
                    
                    // DB Save
                    await prisma.contact.upsert({
                        where: { id: targetJid },
                        update: {
                            name: contacts[targetJid].name,
                            phoneNumber: phoneNumber,
                            lastInteraction: new Date()
                        },
                        create: {
                            id: targetJid,
                            name: contacts[targetJid].name,
                            phoneNumber: phoneNumber,
                            lastInteraction: new Date(),
                            source: 'automatic'
                        }
                    });

                    emitToRelevantUsers(io, 'whatsapp:contact-new', contacts[targetJid]);
                } else {
                    // Update existing contact if we found a phone number now
                    if (phoneNumber && !contacts[targetJid].phoneNumber) {
                        contacts[targetJid].phoneNumber = phoneNumber;
                        
                        // DB Update
                        await prisma.contact.update({
                            where: { id: targetJid },
                            data: { phoneNumber: phoneNumber }
                        });

                        emitToRelevantUsers(io, 'whatsapp:contact-updated', contacts[targetJid]);
                    }
                }
            if (contact.id) {
                await mergeChatsIfNeeded(sessionId, contact.id, state, io);
            }
        }
    });

    sock.ev.on('contacts.update', async (updates) => {
        for (const update of updates) {
            let jid = normalizeJid(update.id);
            
            // Try to resolve PN for LID contacts to find the correct contact to update
            if (jid.endsWith('@lid')) {
                try {
                    const mapping = await state.keys.get('lid-mapping', [jid]);
                    if (mapping && mapping[jid]) {
                        const data = mapping[jid];
                        const pn = typeof data === 'string' ? data : (data as any)?.pn;
                        if (pn) jid = normalizeJid(pn);
                    }
                } catch (e) {
                    console.error('LID resolution failed in contacts.update', e);
                }
            }

            if (jid && contacts[jid]) {
                if (update.name || update.notify || update.verifiedName) {
                    contacts[jid].name = update.name || update.notify || update.verifiedName || contacts[jid].name;
                    emitToRelevantUsers(io, 'whatsapp:contact-updated', contacts[jid]);
                }
            }
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
          if (!rawJid || rawJid === 'status@broadcast' || rawJid.includes('@broadcast')) continue;
          
          let jid = jidNormalizedUser(rawJid);
          let pnJid = jid.endsWith('@s.whatsapp.net') ? jid : null;

          if (jid.endsWith('@lid')) {
            const resolvedPn = await resolvePn(jid, state);
            if (resolvedPn) pnJid = jidNormalizedUser(resolvedPn);
          }

          const targetJid = normalizeJid(pnJid || jid);
          const phoneNumber = getPhoneNumberFromJid(pnJid || '');

          // Automatic contact saving
          if (targetJid && !targetJid.includes('@g.us')) {
            if (!contacts[targetJid]) {
                contacts[targetJid] = {
                    id: targetJid,
                    name: msg.pushName || (phoneNumber || targetJid.split('@')[0]),
                    phoneNumber: phoneNumber,
                    lastInteraction: Date.now(),
                    source: 'automatic'
                };

                // DB Save
                await prisma.contact.upsert({
                    where: { id: targetJid },
                    update: {
                        name: contacts[targetJid].name,
                        phoneNumber: phoneNumber,
                        lastInteraction: new Date()
                    },
                    create: {
                        id: targetJid,
                        name: contacts[targetJid].name,
                        phoneNumber: phoneNumber,
                        lastInteraction: new Date(),
                        source: 'automatic'
                    }
                });

                emitToRelevantUsers(io, 'whatsapp:contact-new', contacts[targetJid]);
            } else {
                contacts[targetJid].lastInteraction = Date.now();
                let needsUpdate = false;
                if (phoneNumber && !contacts[targetJid].phoneNumber) {
                    contacts[targetJid].phoneNumber = phoneNumber;
                    needsUpdate = true;
                }
                if (msg.pushName && (contacts[targetJid].name === targetJid.split('@')[0] || !contacts[targetJid].name)) {
                    contacts[targetJid].name = msg.pushName;
                    needsUpdate = true;
                }

                // DB Update
                await prisma.contact.update({
                    where: { id: targetJid },
                    data: {
                        lastInteraction: new Date(),
                        ...(needsUpdate ? {
                            name: contacts[targetJid].name,
                            phoneNumber: contacts[targetJid].phoneNumber
                        } : {})
                    }
                });

                emitToRelevantUsers(io, 'whatsapp:contact-updated', contacts[targetJid]);
            }
          }

          const chatKey = `${sessionId}--${targetJid}`;
          
          // DB Chat Upsert
          await prisma.chat.upsert({
              where: { id: chatKey },
              update: {
                  timestamp: new Date(),
                  name: contacts[targetJid]?.name || targetJid.split('@')[0]
              },
              create: {
                  id: chatKey,
                  sessionId,
                  jid: targetJid,
                  name: contacts[targetJid]?.name || targetJid.split('@')[0],
                  timestamp: new Date()
              }
          });

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
              messages: [],
              assignedTo: null,
              assignedToName: null
            };
          }

          chats[chatKey].lastMessage = text;
          chats[chatKey].timestamp = (msg.messageTimestamp as number) || Date.now() / 1000;
          
          const msgExists = chats[chatKey].messages.some((existingMsg: any) => existingMsg.key.id === msg.key.id);
          if (!msgExists) {
            chats[chatKey].messages.push(msg);
            if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();

            // DB Message Save
            await prisma.message.upsert({
                where: { id: msg.key.id! },
                update: { status: msg.status || 0 },
                create: {
                    id: msg.key.id!,
                    chatId: chatKey,
                    jid: targetJid,
                    fromMe: msg.key.fromMe || false,
                    text: text,
                    messageTimestamp: msg.messageTimestamp as number,
                    timestamp: new Date((msg.messageTimestamp as number) * 1000),
                    status: msg.status || 0,
                    mediaUrl: msg.mediaUrl,
                    mediaType: msg.mediaType,
                    fileName: msg.fileName
                }
            });
          }

          emitToRelevantUsers(io, 'whatsapp:message', { ...msg, sessionId, chatKey, key: { ...msg.key, remoteJid: jid } });
          await mergeChatsIfNeeded(sessionId, jid, state, io);
        }
      }
    });
  } catch (err) {
    console.error(`Failed to connect to WhatsApp session ${sessionId}:`, err);
    if (sessions[sessionId]) {
        sessions[sessionId].status = 'disconnected';
        emitToRelevantUsers(io, 'whatsapp:session-status', { sessionId, status: 'disconnected', error: 'Failed to connect' });
    }
  }
}

app.prepare().then(async () => {
  const expressApp = express();
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
  try {
    await prisma.$connect();
    console.log('✔ Database connected successfully');
  } catch (err) {
    console.error('✘ Database connection failed!');
    console.error('Please check your DATABASE_URL environment variable.');
    console.error('Error details:', err instanceof Error ? err.message : err);
  }

  await syncFromDb();

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

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    next();
  };

  expressApp.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  expressApp.get('/api/auth/me', authenticate, (req: any, res) => res.json(req.user));
  expressApp.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });

  // User Management
  expressApp.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const dbUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(dbUsers);
  });

  expressApp.post('/api/users', authenticate, isAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'E-mail já cadastrado' });
    
    const newUser = await prisma.user.create({
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
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(role && { role }),
                ...(password && { password: bcrypt.hashSync(password, 10) })
            },
            select: { id: true, name: true, email: true, role: true }
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
        await prisma.user.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        res.status(404).json({ error: 'Usuário não encontrado' });
    }
  });

  expressApp.get('/api/connections', authenticate, (req: any, res) => {
    res.json(Object.values(sessions).map(s => ({ id: s.id, status: s.status, qrCode: s.qrCode, userInfo: s.userInfo })));
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
    await prisma.contact.create({
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
    await prisma.contact.update({
        where: { id },
        data: { name }
    });
    
    // Update name in all chats of this contact
    for (const chatKey in chats) {
        if (chats[chatKey].id === id) {
            chats[chatKey].name = name;
            await prisma.chat.update({
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
    await prisma.contact.delete({ where: { id } });
    
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
        await prisma.chat.upsert({
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
    await prisma.chat.update({
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
    await prisma.chat.update({
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
    await prisma.chat.delete({ where: { id: chatKey } });

    emitToRelevantUsers(io, 'whatsapp:chat-deleted', { chatKey });
    res.json({ success: true });
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
      emitToRelevantUsers(io, 'whatsapp:session-removed', { sessionId: id });
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
    const { jid: rawJid, text, media, mediaType, fileName, mimeType, sessionId, quoted } = req.body;
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
    const userName = req.user.name || 'Atendente';
    const finalMessage = text ? `*${userName}*\n${text}` : '';

    try {
      let msgPayload: any = media && mediaType ? { [mediaType === 'image' ? 'image' : 'document']: Buffer.from(media.split(',')[1], 'base64'), caption: finalMessage, mimetype: mimeType, fileName } : { text: finalMessage || '' };
      const options = quoted ? { quoted } : {};
      const sentMsg = await session.sock.sendMessage(jid, msgPayload, options);
      if (chats[chatKey]) {
        chats[chatKey].lastMessage = finalMessage || (mediaType === 'image' ? '📷 Foto' : '📄 Documento');
        chats[chatKey].messages.push(sentMsg);
        if (chats[chatKey].messages.length > 50) chats[chatKey].messages.shift();
      }
      emitToRelevantUsers(io, 'whatsapp:message', { ...sentMsg, sessionId: targetSessionId, chatKey });
      res.json(sentMsg);
    } catch (err) { res.status(500).json({ error: 'Falha ao enviar' }); }
  });

  expressApp.all(/.*/, (req, res) => handle(req, res, parse(req.url!, true)));

  server.listen(port, hostname, async () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    
    const files = fs.readdirSync(process.cwd());
    const authFolders = files.filter(f => f.startsWith('auth_info_baileys_'));
    if (authFolders.length === 0) connectToWhatsApp(io, 'default');
    else authFolders.forEach(folder => connectToWhatsApp(io, folder.replace('auth_info_baileys_', '')));
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
