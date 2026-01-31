import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

interface LineItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productCode?: string;
  upc?: string;
  verified?: boolean;
  discrepancyType?: string;
  discrepancy?: {
    expected: number;
    actual: number;
    difference: number;
    percentChange: number;
  };
  matchedProduct?: {
    productId: number;
  };
}

interface ReceivingSubmission {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTotal: number;
  subtotal?: number;
  tax?: number;
  lineItems: LineItem[];
  status: 'verified' | 'flagged' | 'rejected';
  notes?: string;
  blobUrl?: string;
  filename?: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: ReceivingSubmission = await request.json();

    const {
      vendorName,
      invoiceNumber,
      invoiceDate,
      invoiceTotal,
      subtotal,
      tax,
      lineItems,
      status,
      notes,
      blobUrl,
      filename,
    } = data;

    // Validate required fields
    if (!invoiceNumber || !invoiceDate || !invoiceTotal) {
      return NextResponse.json({ 
        error: 'Missing required fields: invoiceNumber, invoiceDate, invoiceTotal' 
      }, { status: 400 });
    }

    // Find or create vendor
    let vendorId: number | null = null;
    if (vendorName) {
      const vendorResult = await sql`
        SELECT vendor_id FROM vendors 
        WHERE LOWER(name) LIKE LOWER(${'%' + vendorName.split(' ')[0] + '%'})
        LIMIT 1
      `;
      
      if (vendorResult.rows[0]) {
        vendorId = vendorResult.rows[0].vendor_id;
      } else {
        // Create new vendor
        const newVendor = await sql`
          INSERT INTO vendors (name, created_at) 
          VALUES (${vendorName}, NOW()) 
          RETURNING vendor_id
        `;
        vendorId = newVendor.rows[0].vendor_id;
      }
    }

    // Determine payment status based on verification status
    const paymentStatus = status === 'rejected' ? 'disputed' : 'pending';

    // Calculate promo credits from discrepancies (if any favorable ones)
    const promoCredits = 0; // TODO: Calculate from promotion matches

    // Insert invoice header
    const invoiceResult = await sql`
      INSERT INTO invoices (
        invoice_number, 
        vendor_id, 
        invoice_date, 
        received_date,
        subtotal, 
        tax, 
        total_amount, 
        net_amount,
        promo_credits,
        payment_status, 
        blob_url, 
        scan_filename,
        notes,
        created_at
      ) VALUES (
        ${invoiceNumber},
        ${vendorId},
        ${invoiceDate},
        NOW(),
        ${subtotal || invoiceTotal},
        ${tax || 0},
        ${invoiceTotal},
        ${invoiceTotal - promoCredits},
        ${promoCredits},
        ${paymentStatus},
        ${blobUrl || null},
        ${filename || null},
        ${notes || null},
        NOW()
      )
      ON CONFLICT (vendor_id, invoice_number) DO UPDATE SET
        invoice_date = EXCLUDED.invoice_date,
        subtotal = EXCLUDED.subtotal,
        tax = EXCLUDED.tax,
        total_amount = EXCLUDED.total_amount,
        payment_status = EXCLUDED.payment_status,
        blob_url = COALESCE(EXCLUDED.blob_url, invoices.blob_url),
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING invoice_id
    `;

    const invoiceId = invoiceResult.rows[0].invoice_id;

    // Delete existing line items (in case of re-submission)
    await sql`DELETE FROM invoice_lines WHERE invoice_id = ${invoiceId}`;

    // Insert line items
    for (const item of lineItems) {
      // Find or create product
      let productId: number | null = item.matchedProduct?.productId || null;
      
      if (!productId && item.description) {
        // Try to find existing product
        const descSearch = '%' + item.description.substring(0, 20) + '%';
        let productSearch;
        if (vendorId) {
          productSearch = await sql`
            SELECT product_id FROM products 
            WHERE LOWER(description) LIKE LOWER(${descSearch})
            AND vendor_id = ${vendorId}
            LIMIT 1
          `;
        } else {
          productSearch = await sql`
            SELECT product_id FROM products 
            WHERE LOWER(description) LIKE LOWER(${descSearch})
            LIMIT 1
          `;
        }
        
        if (productSearch.rows[0]) {
          productId = productSearch.rows[0].product_id;
        } else {
          // Create new product
          const newProduct = await sql`
            INSERT INTO products (upc, item_code, description, vendor_id, source, created_at)
            VALUES (${item.upc || null}, ${item.productCode || null}, ${item.description}, ${vendorId}, 'invoice', NOW())
            RETURNING product_id
          `;
          productId = newProduct.rows[0].product_id;
        }
      }

      // Insert invoice line
      await sql`
        INSERT INTO invoice_lines (
          invoice_id,
          product_id,
          line_number,
          upc,
          item_code,
          description,
          quantity,
          unit_cost,
          extended_cost,
          net_unit_cost,
          net_extended,
          created_at
        ) VALUES (
          ${invoiceId},
          ${productId},
          ${item.lineNumber},
          ${item.upc || null},
          ${item.productCode || null},
          ${item.description},
          ${item.quantity},
          ${item.unitPrice},
          ${item.amount},
          ${item.unitPrice},
          ${item.amount},
          NOW()
        )
      `;

      // Update price history if this is a new price
      if (productId && item.unitPrice) {
        // Get current price
        const currentPrice = await sql`
          SELECT unit_cost FROM price_history 
          WHERE product_id = ${productId} 
          ORDER BY effective_date DESC 
          LIMIT 1
        `;

        const previousCost = currentPrice.rows[0]?.unit_cost || null;
        const changePct = previousCost 
          ? ((item.unitPrice - previousCost) / previousCost) * 100 
          : null;

        // Only insert if price is different or no history exists
        if (!previousCost || Math.abs(item.unitPrice - previousCost) > 0.001) {
          await sql`
            INSERT INTO price_history (
              product_id, 
              effective_date, 
              unit_cost, 
              previous_cost, 
              change_pct,
              source_invoice_id,
              created_at
            ) VALUES (
              ${productId},
              ${invoiceDate},
              ${item.unitPrice},
              ${previousCost},
              ${changePct},
              ${invoiceId},
              NOW()
            )
          `;
        }
      }
    }

    // Count discrepancies for response
    const discrepancyCount = lineItems.filter(i => i.discrepancyType).length;

    return NextResponse.json({
      status: 'success',
      invoiceId,
      message: status === 'verified' 
        ? 'Invoice verified and saved' 
        : status === 'flagged'
        ? `Invoice flagged with ${discrepancyCount} discrepancies`
        : 'Invoice rejected and marked for dispute',
      summary: {
        invoiceId,
        invoiceNumber,
        vendorId,
        totalLines: lineItems.length,
        discrepancies: discrepancyCount,
        verificationStatus: status,
      },
    });

  } catch (error) {
    console.error('Receiving submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Fetch pending invoices for approval queue
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');

    const invoices = await sql`
      SELECT 
        i.invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.received_date,
        i.total_amount,
        i.payment_status,
        i.notes,
        i.blob_url,
        v.name as vendor_name,
        v.short_code as vendor_code,
        (SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = i.invoice_id) as line_count
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.vendor_id
      WHERE i.payment_status = ${status}
      ORDER BY i.received_date DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      status: 'success',
      invoices: invoices.rows,
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update invoice status (approve/reject)
export async function PATCH(request: NextRequest) {
  try {
    const { invoiceId, action, notes } = await request.json();

    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'invoiceId and action required' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'paid' : action === 'reject' ? 'disputed' : 'pending';

    await sql`
      UPDATE invoices 
      SET payment_status = ${newStatus},
          notes = COALESCE(${notes}, notes),
          updated_at = NOW()
      WHERE invoice_id = ${invoiceId}
    `;

    return NextResponse.json({
      status: 'success',
      message: `Invoice ${action}d`,
      invoiceId,
      newStatus,
    });

  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
