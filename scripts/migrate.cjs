const fs = require('node:fs');
const path = require('node:path');
const { database } = require('../lib/database.cjs');
async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../database/001-enquiries.sql'), 'utf8');
  const sql = database();
  const statements = source.split(/^-- statement\r?$/m).map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Database migration 1 applied.');
}
main().catch(() => { console.error('Migration failed. Check database connectivity and schema permissions.'); process.exitCode = 1; });
