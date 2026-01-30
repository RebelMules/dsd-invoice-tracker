import { sql } from '@vercel/postgres';

async function seed() {
  console.log('🌱 Seeding database with initial data...\n');

  try {
    // Insert vendors discovered from invoice scans
    const vendors = [
      { name: 'Mitchell Distributing', short_code: 'MITCHELL', category: 'Beverage', loc_vendor_id: 'MITCHELL' },
      { name: 'Prairie Farms Dairy', short_code: 'PRAIRIEFARMS', category: 'Dairy', loc_vendor_id: 'PRAIRIEFARMS' },
      { name: 'Buttermilk Ridge Produce', short_code: 'BUTTERMILK', category: 'Produce', loc_vendor_id: 'BUTTERMILK' },
      { name: 'Lipari Foods', short_code: 'LIPARI', category: 'Specialty', loc_vendor_id: 'LIPARI' },
      { name: 'Quirch Foods', short_code: 'QUIRCH', category: 'Meat/Food Service', loc_vendor_id: 'QUIRCH' },
      { name: "Cooper's Country Meat Packers", short_code: 'COOPERS', category: 'Meat', loc_vendor_id: 'COOPERS' },
      { name: 'Caravan Supply Company', short_code: 'CARAVAN', category: 'Packaging', loc_vendor_id: 'CARAVAN' },
      { name: 'MS Fruit & Vegetable Co.', short_code: 'MSFRUIT', category: 'Produce', loc_vendor_id: 'MSFRUIT' },
      // Common DSD vendors to add
      { name: 'Clark Beverage (Coca-Cola)', short_code: 'COKE', category: 'Beverage', loc_vendor_id: 'COKE' },
      { name: 'Pepsi Bottling', short_code: 'PEPSI', category: 'Beverage', loc_vendor_id: 'PEPSI' },
      { name: 'Frito-Lay', short_code: 'FRITO', category: 'Snack', loc_vendor_id: 'FRITO' },
      { name: 'Little Debbie / McKee Foods', short_code: 'LITTLEDEBBIE', category: 'Bakery', loc_vendor_id: 'LITTLEDEBBIE' },
      { name: 'Flowers Baking', short_code: 'FLOWERS', category: 'Bread', loc_vendor_id: 'FLOWERS' },
      { name: 'Bimbo Bakeries', short_code: 'BIMBO', category: 'Bread', loc_vendor_id: 'BIMBO' },
    ];

    console.log('📦 Inserting vendors...');
    for (const v of vendors) {
      try {
        await sql`
          INSERT INTO vendors (name, short_code, category, loc_vendor_id)
          VALUES (${v.name}, ${v.short_code}, ${v.category}, ${v.loc_vendor_id})
          ON CONFLICT (short_code) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            loc_vendor_id = EXCLUDED.loc_vendor_id
        `;
        console.log(`   ✅ ${v.name}`);
      } catch (err: any) {
        console.log(`   ⚠️  ${v.name}: ${err.message}`);
      }
    }

    // Count results
    const vendorCount = await sql`SELECT COUNT(*) as count FROM vendors`;
    console.log(`\n✅ Seed complete! ${vendorCount.rows[0].count} vendors in database.`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
