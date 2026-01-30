import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

interface LineItem {
  id: string;
  upc?: string;
  itemCode?: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
  totalAmount: number;
  status: 'pending' | 'verified' | 'short' | 'over' | 'missing';
}

interface ScannedItem {
  barcode: string;
  format: string;
  timestamp: string;
  quantity: number;
  matchedLineId?: string;
  productName?: string;
}

interface ReceivingSubmission {
  vendor: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceTotal?: number;
  lineItems: LineItem[];
  scannedItems: ScannedItem[];
  notes?: string;
  mode: 'invoice-first' | 'scan-first';
}

export async function POST(request: NextRequest) {
  try {
    const body: ReceivingSubmission = await request.json();
    const { vendor, invoiceNumber, invoiceDate, invoiceTotal, lineItems, scannedItems, notes, mode } = body;

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor required' }, { status: 400 });
    }

    // Find or create vendor
    let vendorRow = await queryOne<{ vendor_id: number }>(
      `SELECT vendor_id FROM vendors WHERE name ILIKE $1 OR short_code ILIKE $1`,
      [vendor]
    );
    
    let vendorId: number;
    if (!vendorRow) {
      // Create vendor
      const newVendors = await query<{ vendor_id: number }>(
        `INSERT INTO vendors (name, short_code) VALUES ($1, $2) RETURNING vendor_id`,
        [vendor, vendor.substring(0, 10).toUpperCase()]
      );
      vendorId = newVendors[0].vendor_id;
    } else {
      vendorId = vendorRow.vendor_id;
    }

    // Create invoice record
    const invoices = await query<{ invoice_id: number }>(
      `INSERT INTO invoices (
        invoice_number,
        vendor_id,
        invoice_date,
        received_date,
        subtotal,
        total_amount,
        payment_status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
      RETURNING invoice_id`,
      [
        invoiceNumber || `RCV-${Date.now()}`,
        vendorId,
        invoiceDate || new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        invoiceTotal || 0,
        invoiceTotal || 0,
        notes || `Receiving mode: ${mode}`
      ]
    );
    
    const invoiceId = invoices[0].invoice_id;

    // Insert line items
    let lineCount = 0;
    for (const line of lineItems) {
      // Find or create product
      let productId: number | null = null;
      
      if (line.upc) {
        const productRow = await queryOne<{ product_id: number }>(
          `SELECT product_id FROM products WHERE upc = $1`,
          [line.upc]
        );
        
        if (productRow) {
          productId = productRow.product_id;
        } else {
          // Create product
          const newProducts = await query<{ product_id: number }>(
            `INSERT INTO products (upc, item_code, description, vendor_id, source)
             VALUES ($1, $2, $3, $4, 'invoice')
             RETURNING product_id`,
            [line.upc, line.itemCode, line.description, vendorId]
          );
          productId = newProducts[0].product_id;
        }
      }

      await query(
        `INSERT INTO invoice_lines (
          invoice_id,
          product_id,
          line_number,
          upc,
          item_code,
          description,
          quantity,
          unit_cost,
          extended_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          invoiceId,
          productId,
          lineCount + 1,
          line.upc,
          line.itemCode,
          line.description,
          line.receivedQty,
          line.unitCost,
          line.receivedQty * line.unitCost
        ]
      );
      lineCount++;
    }

    // Track unknown scans in notes
    const unknownScans = scannedItems.filter(s => !s.matchedLineId);

    // Calculate summary stats
    const stats = {
      verified: lineItems.filter(i => i.status === 'verified').length,
      short: lineItems.filter(i => i.status === 'short').length,
      over: lineItems.filter(i => i.status === 'over').length,
      notOnInvoice: unknownScans.length,
    };

    // Determine if needs manager review
    const needsReview = stats.short > 0 || stats.over > 0 || stats.notOnInvoice > 0;

    // Update invoice status based on receiving
    const status = needsReview ? 'needs_review' : 'received';
    await query(
      `UPDATE invoices SET payment_status = $1, notes = $2 WHERE invoice_id = $3`,
      [`${notes || ''}\nStats: ${JSON.stringify(stats)}`, status, invoiceId]
    );

    return NextResponse.json({
      success: true,
      invoiceId,
      vendorId,
      lineCount,
      stats,
      needsReview,
      message: needsReview 
        ? 'Submitted for manager review'
        : 'Receiving complete'
    });

  } catch (error) {
    console.error('Receiving submit error:', error);
    return NextResponse.json(
      { error: 'Failed to save receiving data', details: String(error) },
      { status: 500 }
    );
  }
}
