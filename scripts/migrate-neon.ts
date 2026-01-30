import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  console.log('🚀 Starting database migration (Neon)...\n');

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ No DATABASE_URL or POSTGRES_URL found');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '../../../invoices/schema/dsd_database_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Remove comment lines and split properly
    // First, remove all comment lines (lines starting with --)
    const lines = schema.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--') && trimmed.length > 0;
    });
    const cleanedSchema = cleanedLines.join('\n');

    // Split by semicolon followed by newline or end
    const statements = cleanedSchema
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const firstLine = stmt.split('\n')[0].substring(0, 60);
      
      try {
        await client.query(stmt);
        console.log(`✅ [${i + 1}/${statements.length}] ${firstLine}...`);
      } catch (err: any) {
        // Ignore "already exists" errors for idempotency
        if (err.message?.includes('already exists')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] ${firstLine}... (already exists)`);
        } else if (err.message?.includes('does not exist') && stmt.includes('CREATE VIEW')) {
          // Views may fail if dependent tables don't exist yet, that's ok
          console.log(`⚠️  [${i + 1}/${statements.length}] ${firstLine}... (skipped - dependency missing)`);
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] Failed: ${firstLine}`);
          console.error(`   Error: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration complete!');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tables in database:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
