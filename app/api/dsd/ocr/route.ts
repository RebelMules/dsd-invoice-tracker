import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const filename = file.name || `invoice-${Date.now()}.pdf`;
    
    // Determine media type
    let mediaType = file.type;
    if (mediaType === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (!mediaType || mediaType === 'application/octet-stream') {
      // Guess from extension
      if (filename.endsWith('.pdf')) mediaType = 'application/pdf';
      else if (filename.endsWith('.png')) mediaType = 'image/png';
      else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mediaType = 'image/jpeg';
      else if (filename.endsWith('.webp')) mediaType = 'image/webp';
      else if (filename.endsWith('.gif')) mediaType = 'image/gif';
      else mediaType = 'image/jpeg'; // fallback
    }

    // Upload to Vercel Blob for storage
    let blobUrl: string | null = null;
    try {
      const blob = await put(`invoices/${filename}`, buffer, {
        access: 'public',
        contentType: file.type || 'application/pdf',
      });
      blobUrl = blob.url;
    } catch (e) {
      console.warn('Blob upload failed, continuing without storage:', e);
    }

    // Log the scan attempt
    await sql`
      INSERT INTO scan_log (scan_filename, scan_date, blob_url, status)
      VALUES (${filename}, NOW(), ${blobUrl}, 'processing')
    `;

    // Use Claude Vision to extract invoice data
    const systemPrompt = `You are an expert at reading and extracting data from grocery and beverage distributor invoices. 
Extract all structured data from the invoice image/PDF. Be thorough and accurate.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "vendorName": "string or null",
  "vendorAddress": "string or null", 
  "customerName": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "purchaseOrder": "string or null",
  "subtotal": number or null,
  "totalTax": number or null,
  "invoiceTotal": number or null,
  "lineItems": [
    {
      "lineNumber": number,
      "description": "string",
      "quantity": number,
      "unit": "string or null (case, each, lb, etc)",
      "unitPrice": number,
      "amount": number,
      "productCode": "string or null (item code, SKU, or UPC if visible)"
    }
  ]
}

RULES:
- Extract ALL line items, even if there are many
- Numbers should be actual numbers, not strings
- Dates in YYYY-MM-DD format
- If a field is not visible or unclear, use null
- For unit prices, use the per-unit cost (not extended amount)
- Product codes: capture any item codes, SKUs, or UPCs shown
- Be precise with quantities and amounts`;

    const userPrompt = `Extract all invoice data from this document. Return only the JSON object, no other text.`;

    // Build the content array based on media type
    const imageContent: any = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              imageContent,
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      await sql`UPDATE scan_log SET status = 'error', error_message = ${errorText} WHERE scan_filename = ${filename}`;
      return NextResponse.json({ error: 'Claude vision processing failed', details: errorText }, { status: 500 });
    }

    const claudeData = await response.json();
    const content = claudeData.content?.[0]?.text || '';

    // Parse the JSON response
    let extracted;
    try {
      // Handle potential markdown wrapping
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      await sql`UPDATE scan_log SET status = 'error', error_message = 'Failed to parse Claude response' WHERE scan_filename = ${filename}`;
      return NextResponse.json({ 
        error: 'Failed to parse invoice data', 
        rawContent: content 
      }, { status: 500 });
    }

    if (!extracted) {
      await sql`UPDATE scan_log SET status = 'error', error_message = 'No data extracted' WHERE scan_filename = ${filename}`;
      return NextResponse.json({ error: 'No invoice data extracted' }, { status: 500 });
    }

    // Normalize line items
    const lineItems = (extracted.lineItems || []).map((item: any, idx: number) => ({
      lineNumber: item.lineNumber || idx + 1,
      description: item.description || '',
      quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
      unit: item.unit || null,
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(String(item.unitPrice).replace(/[$,]/g, '')) || 0,
      amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount).replace(/[$,]/g, '')) || 0,
      productCode: item.productCode || item.sku || item.itemCode || item.upc || null,
    }));

    const invoice = {
      vendorName: extracted.vendorName || null,
      vendorAddress: extracted.vendorAddress || null,
      customerName: extracted.customerName || null,
      invoiceNumber: extracted.invoiceNumber || null,
      invoiceDate: extracted.invoiceDate || null,
      dueDate: extracted.dueDate || null,
      purchaseOrder: extracted.purchaseOrder || null,
      subtotal: typeof extracted.subtotal === 'number' ? extracted.subtotal : parseFloat(String(extracted.subtotal).replace(/[$,]/g, '')) || null,
      totalTax: typeof extracted.totalTax === 'number' ? extracted.totalTax : parseFloat(String(extracted.totalTax).replace(/[$,]/g, '')) || null,
      invoiceTotal: typeof extracted.invoiceTotal === 'number' ? extracted.invoiceTotal : parseFloat(String(extracted.invoiceTotal).replace(/[$,]/g, '')) || null,
      lineItems,
      rawContent: content,
      confidence: null, // Claude doesn't provide confidence scores
      blobUrl,
      filename,
    };

    // Update scan log
    await sql`
      UPDATE scan_log 
      SET status = 'processed', 
          invoices_extracted = 1, 
          lines_extracted = ${lineItems.length},
          processed_at = NOW()
      WHERE scan_filename = ${filename}
    `;

    return NextResponse.json({
      status: 'success',
      invoice,
    });

  } catch (error) {
    console.error('DSD OCR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
