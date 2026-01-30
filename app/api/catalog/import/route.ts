import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * Catalog Import API - Bulk import products from AWG or internal catalog
 * 
 * POST /api/catalog/import
 * Body: { source: 'awg' | 'internal', products: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, products } = body;

    if (!source || !products || !Array.isArray(products)) {
      return NextResponse.json(
        { error: 'source and products array required' },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    if (source === 'awg') {
      // Import to AWG catalog
      for (const p of products) {
        try {
          await sql`
            INSERT INTO awg_catalog (
              upc, item_number, description, brand, vendor_name,
              pack_size, case_cost, category, subcategory, department,
              is_dsd, last_synced
            )
            VALUES (
              ${p.upc}, ${p.item_number || null}, ${p.description},
              ${p.brand || null}, ${p.vendor_name || null},
              ${p.pack_size || null}, ${p.case_cost || null},
              ${p.category || null}, ${p.subcategory || null},
              ${p.department || null}, ${p.is_dsd || false}, NOW()
            )
            ON CONFLICT (upc, item_number) 
            DO UPDATE SET
              description = EXCLUDED.description,
              brand = EXCLUDED.brand,
              vendor_name = EXCLUDED.vendor_name,
              pack_size = EXCLUDED.pack_size,
              case_cost = EXCLUDED.case_cost,
              category = EXCLUDED.category,
              is_dsd = EXCLUDED.is_dsd,
              last_synced = NOW()
          `;
          imported++;
        } catch (err: any) {
          skipped++;
          if (errors.length < 10) {
            errors.push(`${p.upc}: ${err.message}`);
          }
        }
      }
    } else if (source === 'internal') {
      // Import to internal products table
      for (const p of products) {
        try {
          await sql`
            INSERT INTO products (
              upc, item_code, description, vendor_id,
              pack_size, unit_of_measure, category, subcategory,
              department, source
            )
            VALUES (
              ${p.upc}, ${p.item_code || null}, ${p.description},
              ${p.vendor_id}, ${p.pack_size || null}, ${p.unit_of_measure || 'case'},
              ${p.category || null}, ${p.subcategory || null},
              ${p.department || null}, 'internal'
            )
            ON CONFLICT (upc) 
            DO UPDATE SET
              description = EXCLUDED.description,
              vendor_id = EXCLUDED.vendor_id,
              pack_size = EXCLUDED.pack_size,
              updated_at = NOW()
          `;
          imported++;
        } catch (err: any) {
          skipped++;
          if (errors.length < 10) {
            errors.push(`${p.upc}: ${err.message}`);
          }
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid source. Use "awg" or "internal"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      source,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Catalog import error:', error);
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * Match AWG catalog entries to our vendor table
 * 
 * PATCH /api/catalog/import
 * Attempts to auto-match vendor_name from AWG to our vendors
 */
export async function PATCH(request: NextRequest) {
  try {
    // Auto-match AWG catalog vendor names to our vendor table
    const result = await sql`
      UPDATE awg_catalog a
      SET vendor_id = v.vendor_id
      FROM vendors v
      WHERE a.vendor_id IS NULL
        AND (
          LOWER(a.vendor_name) LIKE LOWER('%' || v.name || '%')
          OR LOWER(a.vendor_name) LIKE LOWER('%' || v.short_code || '%')
          OR LOWER(a.brand) LIKE LOWER('%' || v.name || '%')
        )
    `;

    // Get count of matched and unmatched
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) AS matched,
        COUNT(*) FILTER (WHERE vendor_id IS NULL) AS unmatched
      FROM awg_catalog
    `;

    return NextResponse.json({
      success: true,
      matched: stats.rows[0].matched,
      unmatched: stats.rows[0].unmatched,
      message: 'Vendor matching complete'
    });

  } catch (error) {
    console.error('Vendor matching error:', error);
    return NextResponse.json(
      { error: 'Matching failed' },
      { status: 500 }
    );
  }
}
