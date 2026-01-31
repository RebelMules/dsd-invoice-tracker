import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// GET: Fetch promos or vendors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Return vendors list
    if (type === 'vendors') {
      const result = await sql`
        SELECT vendor_id, name, short_code 
        FROM vendors 
        ORDER BY name
      `;
      return NextResponse.json({ vendors: result.rows });
    }

    // Return promos with vendor names
    const result = await sql`
      SELECT 
        p.promo_id,
        p.vendor_id,
        v.name as vendor_name,
        p.description,
        p.promo_type,
        p.start_date,
        p.end_date,
        p.allowance_amount,
        p.allowance_type,
        p.min_qty,
        p.notes,
        p.created_at
      FROM promotions p
      LEFT JOIN vendors v ON p.vendor_id = v.vendor_id
      ORDER BY p.start_date DESC
    `;

    // Get products for each promo
    const promos = await Promise.all(
      result.rows.map(async (promo) => {
        const products = await sql`
          SELECT pr.upc, pr.description, pr.item_code
          FROM promo_products pp
          JOIN products pr ON pp.product_id = pr.product_id
          WHERE pp.promo_id = ${promo.promo_id}
        `;
        return { ...promo, products: products.rows };
      })
    );

    return NextResponse.json({ promos });

  } catch (error) {
    console.error('Get promos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new promo
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const {
      vendor_id,
      description,
      promo_type,
      start_date,
      end_date,
      allowance_amount,
      allowance_type,
      min_qty,
      notes,
      sms_deal_type,
      sms_deal_cost,
      sms_ad_price,
      sms_limit,
      products,
    } = data;

    if (!vendor_id || !description || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: vendor_id, description, start_date, end_date' 
      }, { status: 400 });
    }

    // Insert promo
    const result = await sql`
      INSERT INTO promotions (
        vendor_id,
        description,
        promo_type,
        start_date,
        end_date,
        allowance_amount,
        allowance_type,
        min_qty,
        notes,
        created_at
      ) VALUES (
        ${vendor_id},
        ${description},
        ${promo_type || 'off-invoice'},
        ${start_date},
        ${end_date},
        ${allowance_amount || 0},
        ${allowance_type || 'per_case'},
        ${min_qty || null},
        ${notes || null},
        NOW()
      )
      RETURNING promo_id
    `;

    const promoId = result.rows[0].promo_id;

    // Link products to promo
    if (products && products.length > 0) {
      for (const product of products) {
        // Find or create product
        let productId: number | null = null;

        if (product.upc) {
          const existing = await sql`
            SELECT product_id FROM products WHERE upc = ${product.upc} LIMIT 1
          `;
          productId = existing.rows[0]?.product_id;
        }

        if (!productId && product.description) {
          // Create new product
          const newProduct = await sql`
            INSERT INTO products (upc, item_code, description, vendor_id, source, created_at)
            VALUES (${product.upc || null}, ${product.item_code || null}, ${product.description}, ${vendor_id}, 'promo', NOW())
            ON CONFLICT (upc) DO UPDATE SET description = EXCLUDED.description
            RETURNING product_id
          `;
          productId = newProduct.rows[0]?.product_id;
        }

        if (productId) {
          await sql`
            INSERT INTO promo_products (promo_id, product_id)
            VALUES (${promoId}, ${productId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      promo_id: promoId,
      message: 'Promo created successfully',
    });

  } catch (error) {
    console.error('Create promo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update existing promo
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

    const {
      promo_id,
      vendor_id,
      description,
      promo_type,
      start_date,
      end_date,
      allowance_amount,
      allowance_type,
      min_qty,
      notes,
      products,
    } = data;

    if (!promo_id) {
      return NextResponse.json({ error: 'promo_id required' }, { status: 400 });
    }

    await sql`
      UPDATE promotions SET
        vendor_id = ${vendor_id},
        description = ${description},
        promo_type = ${promo_type || 'off-invoice'},
        start_date = ${start_date},
        end_date = ${end_date},
        allowance_amount = ${allowance_amount || 0},
        allowance_type = ${allowance_type || 'per_case'},
        min_qty = ${min_qty || null},
        notes = ${notes || null}
      WHERE promo_id = ${promo_id}
    `;

    // Update products - clear and re-add
    await sql`DELETE FROM promo_products WHERE promo_id = ${promo_id}`;

    if (products && products.length > 0) {
      for (const product of products) {
        let productId: number | null = null;

        if (product.upc) {
          const existing = await sql`
            SELECT product_id FROM products WHERE upc = ${product.upc} LIMIT 1
          `;
          productId = existing.rows[0]?.product_id;
        }

        if (!productId && product.description) {
          const newProduct = await sql`
            INSERT INTO products (upc, item_code, description, vendor_id, source, created_at)
            VALUES (${product.upc || null}, ${product.item_code || null}, ${product.description}, ${vendor_id}, 'promo', NOW())
            ON CONFLICT (upc) DO UPDATE SET description = EXCLUDED.description
            RETURNING product_id
          `;
          productId = newProduct.rows[0]?.product_id;
        }

        if (productId) {
          await sql`
            INSERT INTO promo_products (promo_id, product_id)
            VALUES (${promo_id}, ${productId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      message: 'Promo updated successfully',
    });

  } catch (error) {
    console.error('Update promo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove promo
export async function DELETE(request: NextRequest) {
  try {
    const { promo_id } = await request.json();

    if (!promo_id) {
      return NextResponse.json({ error: 'promo_id required' }, { status: 400 });
    }

    // Delete product links first
    await sql`DELETE FROM promo_products WHERE promo_id = ${promo_id}`;
    
    // Delete promo
    await sql`DELETE FROM promotions WHERE promo_id = ${promo_id}`;

    return NextResponse.json({
      status: 'success',
      message: 'Promo deleted',
    });

  } catch (error) {
    console.error('Delete promo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
