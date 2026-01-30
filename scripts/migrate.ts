import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '../../invoices/schema/dsd_database_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
      
      try {
        await sql.query(stmt);
        console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
      } catch (err: any) {
        // Ignore "already exists" errors for idempotency
        if (err.message?.includes('already exists')) {
          console.log(`⏭️  [${i + 1}/${statements.length}] ${preview}... (already exists)`);
        } else {
          console.error(`❌ [${i + 1}/${statements.length}] Failed: ${preview}`);
          console.error(`   Error: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration complete!');
    
    // Verify tables
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('\n📊 Tables created:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
