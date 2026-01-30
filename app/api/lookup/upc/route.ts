import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

/**
 * UPC Lookup API - Auto-suggest vendor from product catalogs
 * 
 * Lookup priority:
 * 1. Internal products table (our verified data)
 * 2. AWG catalog (wholesale master database)
 * 3. Not found → return empty, allow manual entry
 * 
 * GET /api/lookup/upc?upc=012345678901
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const upc = searchParams.get('upc');

  if (!upc) {
    return NextResponse.json({ error: 'UPC required' }, { status: 400 });
  }

  // Normalize UPC (strip leading zeros for comparison, handle UPC-A vs EAN)
  const normalizedUpc = upc.replace(/^0+/, '');
  const paddedUpc = upc.padStart(12, '0'); // UPC-A format

  try {
    // Priority 1: Check internal products table first (verified data)
    const internalProduct = await queryOne(`
      SELECT 
        p.product_id,
        p.upc,
        p.description,
        p.item_code,
        p.pack_size,
        p.unit_of_measure,
        p.category,
        p.source,
        p.verified,
        v.vendor_id,
        v.name AS vendor_name,
        v.short_code AS vendor_code,
        'internal' AS lookup_source,
        1 AS priority
      FROM products p
      JOIN vendors v ON p.vendor_id = v.vendor_id
      WHERE p.upc = $1 OR p.upc = $2 OR p.upc = $3
      LIMIT 1
    `, [upc, normalizedUpc, paddedUpc]);

    if (internalProduct) {
      return NextResponse.json({
        found: true,
        source: 'internal',
        product: internalProduct,
        confidence: internalProduct.verified ? 'high' : 'medium'
      });
    }

    // Priority 2: Check AWG catalog
    const awgProduct = await queryOne(`
      SELECT 
        a.awg_id,
        a.upc,
        a.description,
        a.item_number,
        a.brand,
        a.pack_size,
        a.category,
        a.is_dsd,
        v.vendor_id,
        v.name AS vendor_name,
        v.short_code AS vendor_code,
        'awg' AS lookup_source,
        2 AS priority
      FROM awg_catalog a
      LEFT JOIN vendors v ON a.vendor_id = v.vendor_id
      WHERE a.upc = $1 OR a.upc = $2 OR a.upc = $3
      ORDER BY a.is_dsd DESC, a.vendor_id IS NOT NULL DESC
      LIMIT 1
    `, [upc, normalizedUpc, paddedUpc]);

    if (awgProduct) {
      return NextResponse.json({
        found: true,
        source: 'awg',
        product: awgProduct,
        confidence: awgProduct.vendor_id ? 'medium' : 'low',
        note: awgProduct.is_dsd 
          ? 'Common DSD item' 
          : 'AWG catalog match - verify vendor'
      });
    }

    // Not found in any catalog
    return NextResponse.json({
      found: false,
      source: null,
      product: null,
      note: 'UPC not in catalog - manual entry required'
    });

  } catch (error) {
    console.error('UPC lookup error:', error);
    return NextResponse.json(
      { error: 'Lookup failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lookup/upc - Add new UPC to internal catalog
 * Used when manually entering a product during receiving
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { upc, description, vendor_id, pack_size, category, item_code } = body;

    if (!upc || !description || !vendor_id) {
      return NextResponse.json(
        { error: 'UPC, description, and vendor_id required' },
        { status: 400 }
      );
    }

    // Insert or update product
    const result = await query(`
      INSERT INTO products (upc, description, vendor_id, pack_size, category, item_code, source)
      VALUES ($1, $2, $3, $4, $5, $6, 'manual')
      ON CONFLICT (upc) 
      DO UPDATE SET
        description = COALESCE(EXCLUDED.description, products.description),
        vendor_id = COALESCE(EXCLUDED.vendor_id, products.vendor_id),
        pack_size = COALESCE(EXCLUDED.pack_size, products.pack_size),
        updated_at = NOW()
      RETURNING product_id, upc, description
    `, [upc, description, vendor_id, pack_size, category, item_code]);

    return NextResponse.json({
      success: true,
      product: result[0],
      message: 'Product saved to internal catalog'
    });

  } catch (error) {
    console.error('Product save error:', error);
    return NextResponse.json(
      { error: 'Failed to save product' },
      { status: 500 }
    );
  }
}
