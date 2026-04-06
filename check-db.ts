import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMessages() {
  console.log('Checking messages in database...');
  try {
    const messages = await prisma.message.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        contact: true
      }
    });

    console.log(`Total messages: ${messages.length}`);
    messages.forEach(m => {
      console.log(`[${m.timestamp.toISOString()}] From: ${m.jid} (${m.contact?.name || 'Unknown'}) - Text: ${m.text} - fromMe: ${m.fromMe}`);
    });

    const contacts = await prisma.contact.findMany({
      orderBy: { lastInteraction: 'desc' }
    });

    console.log(`\nTotal contacts: ${contacts.length}`);
    contacts.forEach(c => {
      console.log(`${c.id} - Name: ${c.name} - Last Interaction: ${c.lastInteraction.toISOString()}`);
    });

    const chats = await prisma.chat.findMany();
    console.log(`\nTotal chats: ${chats.length}`);
    chats.forEach(c => {
      console.log(`${c.id} - Name: ${c.name} - AssignedTo: ${c.assignedTo}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMessages();
