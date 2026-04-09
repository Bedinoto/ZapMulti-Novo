import mysql from 'mysql2/promise';
import { nanoid } from 'nanoid';

// Database URL - Priority: Environment Variable > Hardcoded Fallback
const dbUrl = process.env.DATABASE_URL || "mysql://u801415719_zapapi:+5mNmLbAjF@srv1076.hstgr.io:3306/u801415719_zapapi";

export const pool = mysql.createPool({
  uri: dbUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}

export const db = {
  user: {
    findUnique: async ({ where }: { where: { email?: string, id?: string } }) => {
      const sql = where.email 
        ? 'SELECT * FROM User WHERE email = ? LIMIT 1' 
        : 'SELECT * FROM User WHERE id = ? LIMIT 1';
      const val = where.email || where.id;
      const rows = await query<any[]>(sql, [val]);
      return rows[0] || null;
    },
    findMany: async () => {
      return await query<any[]>('SELECT * FROM User ORDER BY createdAt DESC');
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || nanoid();
      const sql = 'INSERT INTO User (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())';
      await query(sql, [id, data.email, data.password, data.name || null, data.role || 'user']);
      return { id, ...data };
    },
    update: async ({ where, data }: { where: { id: string }, data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const sql = `UPDATE User SET ${setClause}, updatedAt = NOW() WHERE id = ?`;
      await query(sql, [...values, where.id]);
      return { id: where.id, ...data };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await query('DELETE FROM User WHERE id = ?', [where.id]);
      return { id: where.id };
    }
  },
  contact: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const rows = await query<any[]>('SELECT * FROM Contact WHERE id = ? LIMIT 1', [where.id]);
      return rows[0] || null;
    },
    findMany: async () => {
      return await query<any[]>('SELECT * FROM Contact ORDER BY lastInteraction DESC');
    },
    upsert: async ({ where, update, create }: { where: { id: string }, update: any, create: any }) => {
      const existing = await db.contact.findUnique({ where });
      if (existing) {
        const keys = Object.keys(update);
        const values = Object.values(update);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const sql = `UPDATE Contact SET ${setClause}, updatedAt = NOW() WHERE id = ?`;
        await query(sql, [...values, where.id]);
        return { ...existing, ...update };
      } else {
        const keys = Object.keys(create);
        const values = Object.values(create);
        const columns = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO Contact (${columns}, createdAt, updatedAt) VALUES (${placeholders}, NOW(), NOW())`;
        await query(sql, values);
        return create;
      }
    },
    create: async ({ data }: { data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const columns = keys.join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO Contact (${columns}, createdAt, updatedAt) VALUES (${placeholders}, NOW(), NOW())`;
      await query(sql, values);
      return data;
    },
    update: async ({ where, data }: { where: { id: string }, data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const sql = `UPDATE Contact SET ${setClause}, updatedAt = NOW() WHERE id = ?`;
      await query(sql, [...values, where.id]);
      return { id: where.id, ...data };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await query('DELETE FROM Contact WHERE id = ?', [where.id]);
      return { id: where.id };
    }
  },
  chat: {
    findUnique: async ({ where }: { where: { id?: string, sessionId_jid?: { sessionId: string, jid: string } } }) => {
      if (where.id) {
        const rows = await query<any[]>('SELECT * FROM Chat WHERE id = ? LIMIT 1', [where.id]);
        return rows[0] || null;
      } else if (where.sessionId_jid) {
        const rows = await query<any[]>('SELECT * FROM Chat WHERE sessionId = ? AND jid = ? LIMIT 1', [where.sessionId_jid.sessionId, where.sessionId_jid.jid]);
        return rows[0] || null;
      }
      return null;
    },
    findMany: async ({ where }: { where?: any } = {}) => {
      let sql = 'SELECT * FROM Chat';
      const params: any[] = [];
      if (where?.sessionId) {
        sql += ' WHERE sessionId = ?';
        params.push(where.sessionId);
      }
      sql += ' ORDER BY timestamp DESC';
      return await query<any[]>(sql, params);
    },
    create: async ({ data }: { data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const columns = keys.join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO Chat (${columns}) VALUES (${placeholders})`;
      await query(sql, values);
      return data;
    },
    update: async ({ where, data }: { where: { id: string }, data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const sql = `UPDATE Chat SET ${setClause} WHERE id = ?`;
      await query(sql, [...values, where.id]);
      return { id: where.id, ...data };
    },
    upsert: async ({ where, update, create }: { where: { id: string }, update: any, create: any }) => {
      const existing = await db.chat.findUnique({ where: { id: where.id } });
      if (existing) {
        return await db.chat.update({ where: { id: where.id }, data: update });
      } else {
        return await db.chat.create({ data: create });
      }
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await query('DELETE FROM Chat WHERE id = ?', [where.id]);
      return { id: where.id };
    }
  },
  message: {
    findMany: async ({ where, orderBy, take }: { where?: any, orderBy?: any, take?: number } = {}) => {
      let sql = 'SELECT * FROM Message';
      const params: any[] = [];
      const conditions: string[] = [];
      if (where?.chatId) {
        conditions.push('chatId = ?');
        params.push(where.chatId);
      }
      if (where?.jid) {
        conditions.push('jid = ?');
        params.push(where.jid);
      }
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      if (orderBy?.timestamp) {
        sql += ` ORDER BY timestamp ${orderBy.timestamp.toUpperCase()}`;
      }
      if (take) {
        sql += ` LIMIT ${take}`;
      }
      return await query<any[]>(sql, params);
    },
    create: async ({ data }: { data: any }) => {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const columns = keys.join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO Message (${columns}) VALUES (${placeholders})`;
      await query(sql, values);
      return data;
    },
    upsert: async ({ where, update, create }: { where: { id: string }, update: any, create: any }) => {
      const rows = await query<any[]>('SELECT id FROM Message WHERE id = ? LIMIT 1', [where.id]);
      if (rows.length > 0) {
        const keys = Object.keys(update);
        const values = Object.values(update);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const sql = `UPDATE Message SET ${setClause} WHERE id = ?`;
        await query(sql, [...values, where.id]);
        return { id: where.id, ...update };
      } else {
        return await db.message.create({ data: create });
      }
    }
  },
  session: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const rows = await query<any[]>('SELECT * FROM Session WHERE id = ? LIMIT 1', [where.id]);
      return rows[0] || null;
    },
    findMany: async () => {
      return await query<any[]>('SELECT * FROM Session');
    },
    upsert: async ({ where, update, create }: { where: { id: string }, update: any, create: any }) => {
      const existing = await db.session.findUnique({ where });
      if (existing) {
        const keys = Object.keys(update);
        const values = Object.values(update);
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const sql = `UPDATE Session SET ${setClause}, updatedAt = NOW() WHERE id = ?`;
        await query(sql, [...values, where.id]);
        return { ...existing, ...update };
      } else {
        const keys = Object.keys(create);
        const values = Object.values(create);
        const columns = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO Session (${columns}, createdAt, updatedAt) VALUES (${placeholders}, NOW(), NOW())`;
        await query(sql, values);
        return create;
      }
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await query('DELETE FROM Session WHERE id = ?', [where.id]);
      return { id: where.id };
    }
  }
};
