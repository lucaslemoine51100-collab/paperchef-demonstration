const {randomUUID}=require('node:crypto');
const {problem}=require('./accounts.cjs');
async function initialize(db){for(const sql of [
 `CREATE TABLE IF NOT EXISTS paperchef.chat_messages(id text PRIMARY KEY,sender_id text NOT NULL REFERENCES paperchef.users(id),recipient_id text REFERENCES paperchef.users(id),body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`,
 `CREATE INDEX IF NOT EXISTS chat_messages_date ON paperchef.chat_messages(created_at)`,
 `CREATE TABLE IF NOT EXISTS paperchef.chat_reads(user_id text NOT NULL REFERENCES paperchef.users(id),message_id text NOT NULL REFERENCES paperchef.chat_messages(id) ON DELETE CASCADE,PRIMARY KEY(user_id,message_id))`
])await db.query(sql);}
async function inbox(db,user){const users=(await db.query('SELECT id,name,role FROM paperchef.users WHERE active AND id<>$1 ORDER BY name',[user.id])).rows;
const messages=(await db.query(`SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,u.name,u.role,r.message_id IS NOT NULL AS read FROM paperchef.chat_messages m JOIN paperchef.users u ON u.id=m.sender_id LEFT JOIN paperchef.chat_reads r ON r.message_id=m.id AND r.user_id=$1 WHERE m.recipient_id IS NULL OR m.sender_id=$1 OR m.recipient_id=$1 ORDER BY m.created_at DESC,m.id DESC LIMIT 1000`,[user.id])).rows.reverse();return {users,messages};}
async function handle(db,user,method,input){if(method==='GET')return inbox(db,user);
if(method!=='POST')throw problem('Action inconnue.',405);
if(input.action==='read'){const ids=input.ids;if(!Array.isArray(ids)||ids.length>1000||ids.some(x=>typeof x!=='string'))throw problem('Messages invalides.');
await db.query(`INSERT INTO paperchef.chat_reads(user_id,message_id) SELECT $1,id FROM paperchef.chat_messages WHERE id=ANY($2::text[]) AND sender_id<>$1 AND (recipient_id IS NULL OR recipient_id=$1) ON CONFLICT DO NOTHING`,[user.id,ids]);return {saved:true};}
if(input.action==='delete'){const removed=await db.query('DELETE FROM paperchef.chat_messages WHERE id=$1 AND sender_id=$2 RETURNING id',[input.id,user.id]);if(!removed.rows.length)throw problem('Vous pouvez supprimer uniquement vos messages.',403);return {saved:true};}
if(input.action!=='send')throw problem('Action inconnue.');const body=typeof input.body==='string'?input.body.trim():'';if(!body||body.length>4000)throw problem('Le message doit comporter de 1 à 4 000 caractères.');const recipient=input.recipientId||null;
if(recipient&&(recipient===user.id||!(await db.query('SELECT id FROM paperchef.users WHERE id=$1 AND active',[recipient])).rows.length))throw problem('Destinataire indisponible.');
await db.query('INSERT INTO paperchef.chat_messages(id,sender_id,recipient_id,body) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,recipient,body]);return {saved:true};}
module.exports={initialize,handle};
