import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

interface LineItemCheck {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { vendorName, lineItems } = await request.json();

    if (!lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json({ error: 'Line items required' }, { status: 400 });
    }

    // Find vendor by name (fuzzy match)
    const vendorResult = await sql`
      SELECT vendor_id, name, short_code 
      FROM vendors 
      WHERE LOWER(name) LIKE LOWER(${'%' + (vendorName || '').split(' ')[0] + '%'})
      LIMIT 1
    `;

    const vendor = vendorResult.rows[0] || null;
    const vendorId = vendor?.vendor_id || null;

    // For each line item, look up expected price from price_history
    const checkedItems = await Promise.all(
      lineItems.map(async (item: LineItemCheck, idx: number) => {
        const descriptionSearch = '%' + (item.description || '').substring(0, 20) + '%';
        const productCode = item.productCode || '';

        // Query with optional vendor filter
        let productResult;
        if (vendorId) {
          productResult = await sql`
            SELECT p.product_id, p.upc, p.description, p.item_code,
                   ph.unit_cost as expected_cost, ph.effective_date
            FROM products p
            LEFT JOIN LATERAL (
              SELECT unit_cost, effective_date 
              FROM price_history 
              WHERE product_id = p.product_id 
              ORDER BY effective_date DESC 
              LIMIT 1
            ) ph ON true
            WHERE (
              LOWER(p.description) LIKE LOWER(${descriptionSearch})
              OR p.item_code = ${productCode}
            )
            AND p.vendor_id = ${vendorId}
            LIMIT 1
          `;
        } else {
          productResult = await sql`
            SELECT p.product_id, p.upc, p.description, p.item_code,
                   ph.unit_cost as expected_cost, ph.effective_date
            FROM products p
            LEFT JOIN LATERAL (
              SELECT unit_cost, effective_date 
              FROM price_history 
              WHERE product_id = p.product_id 
              ORDER BY effective_date DESC 
              LIMIT 1
            ) ph ON true
            WHERE (
              LOWER(p.description) LIKE LOWER(${descriptionSearch})
              OR p.item_code = ${productCode}
            )
            LIMIT 1
          `;
        }

        const matchedProduct = productResult.rows[0] || null;
        
        let discrepancy = null;
        let discrepancyType = null;
        
        if (matchedProduct?.expected_cost && item.unitPrice) {
          const priceDiff = item.unitPrice - matchedProduct.expected_cost;
          const priceDiffPct = (priceDiff / matchedProduct.expected_cost) * 100;
          
          // Flag if price differs by more than 2%
          if (Math.abs(priceDiffPct) > 2) {
            discrepancy = {
              expected: matchedProduct.expected_cost,
              actual: item.unitPrice,
              difference: priceDiff,
              percentChange: priceDiffPct,
            };
            discrepancyType = priceDiff > 0 ? 'price_increase' : 'price_decrease';
          }
        }

        return {
          lineNumber: idx + 1,
          description: item.description,
          quantity: item.quantity,
          invoicedUnitPrice: item.unitPrice,
          invoicedAmount: item.amount,
          productCode: item.productCode,
          // Match info
          matched: !!matchedProduct,
          matchedProduct: matchedProduct ? {
            productId: matchedProduct.product_id,
            upc: matchedProduct.upc,
            description: matchedProduct.description,
            itemCode: matchedProduct.item_code,
            expectedCost: matchedProduct.expected_cost,
            lastPriceDate: matchedProduct.effective_date,
          } : null,
          // Discrepancy info
          hasDiscrepancy: !!discrepancy,
          discrepancyType,
          discrepancy,
        };
      })
    );

    // Summarize discrepancies
    const summary = {
      totalLines: checkedItems.length,
      matchedLines: checkedItems.filter(i => i.matched).length,
      unmatchedLines: checkedItems.filter(i => !i.matched).length,
      priceIncreases: checkedItems.filter(i => i.discrepancyType === 'price_increase').length,
      priceDecreases: checkedItems.filter(i => i.discrepancyType === 'price_decrease').length,
      hasIssues: checkedItems.some(i => i.hasDiscrepancy || !i.matched),
    };

    return NextResponse.json({
      status: 'success',
      vendor,
      lineItems: checkedItems,
      summary,
    });

  } catch (error) {
    console.error('Price check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
