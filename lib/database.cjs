const { neon } = require('@neondatabase/serverless');
let client;
function database() {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration missing');
  return client ||= neon(process.env.DATABASE_URL);
}
async function saveEnquiry(data, key, hash, ipHash) {
  const sql = database();
  const rows = await sql`SELECT * FROM submit_enquiry(${key}::uuid, ${hash}, ${ipHash}, ${data.name}, ${data.venue}, ${data.email}, ${data.phone}, ${data.message})`;
  return rows[0];
}
module.exports = { database, saveEnquiry };
