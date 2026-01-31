import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// GET: Fetch returned checks with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Return stats summary
    if (type === 'stats') {
      const stats = await sql`
        SELECT 
          COUNT(CASE WHEN status = 'uncollected' THEN 1 END) as uncollected_count,
          COALESCE(SUM(CASE WHEN status = 'uncollected' THEN check_amount ELSE 0 END), 0) as uncollected_amount,
          COUNT(CASE WHEN status = 'collected' THEN 1 END) as collected_count,
          COALESCE(SUM(CASE WHEN status = 'collected' THEN check_amount ELSE 0 END), 0) as collected_amount,
          COUNT(*) as total_count,
          COALESCE(SUM(check_amount), 0) as total_amount
        FROM returned_checks
      `;
      return NextResponse.json({ stats: stats.rows[0] });
    }

    // Return checks list
    let checks;
    if (status && status !== 'all') {
      checks = await sql`
        SELECT 
          check_id,
          maker_name,
          check_number,
          check_amount,
          check_date,
          return_date,
          return_reason,
          status,
          maker_phone,
          maker_address,
          notes,
          blob_url,
          (CURRENT_DATE - return_date) as days_outstanding,
          created_at,
          updated_at
        FROM returned_checks
        WHERE status = ${status}
        ORDER BY return_date DESC
      `;
    } else {
      checks = await sql`
        SELECT 
          check_id,
          maker_name,
          check_number,
          check_amount,
          check_date,
          return_date,
          return_reason,
          status,
          maker_phone,
          maker_address,
          notes,
          blob_url,
          (CURRENT_DATE - return_date) as days_outstanding,
          created_at,
          updated_at
        FROM returned_checks
        ORDER BY 
          CASE status WHEN 'uncollected' THEN 1 ELSE 2 END,
          return_date DESC
      `;
    }

    return NextResponse.json({ checks: checks.rows });

  } catch (error) {
    console.error('Get returned checks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new returned check (with optional OCR)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle file upload with OCR
    if (contentType.includes('multipart/form-data')) {
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
      const filename = file.name || `check-${Date.now()}.jpg`;

      // Determine media type
      let mediaType = file.type;
      if (!mediaType || mediaType === 'application/octet-stream') {
        if (filename.endsWith('.png')) mediaType = 'image/png';
        else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mediaType = 'image/jpeg';
        else if (filename.endsWith('.webp')) mediaType = 'image/webp';
        else mediaType = 'image/jpeg';
      }

      // Upload to Vercel Blob
      let blobUrl: string | null = null;
      try {
        const blob = await put(`returned-checks/${filename}`, buffer, {
          access: 'public',
          contentType: mediaType,
        });
        blobUrl = blob.url;
      } catch (e) {
        console.warn('Blob upload failed:', e);
      }

      // Use Claude Vision to extract check details
      const systemPrompt = `You are an expert at reading personal and business checks. Extract all visible information from this check image.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "maker_name": "string - name of person/business who wrote the check",
  "check_number": "string - check number",
  "check_amount": number - dollar amount,
  "check_date": "YYYY-MM-DD or null",
  "bank_name": "string - bank name if visible",
  "routing_number": "string - 9-digit routing number if visible",
  "account_number": "string - last 4 digits only for security, like '****1234'",
  "maker_address": "string - address if printed on check",
  "maker_phone": "string - phone if printed on check"
}

RULES:
- Extract the PAYEE name (who the check is made out to) separately if different from maker
- Amount should be a number (e.g., 125.50 not "$125.50")
- If a field is not visible or unclear, use null
- For account number, only include last 4 digits for security
- Be precise with the amount - look at both written and numeric amounts`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64,
                  },
                },
                { type: 'text', text: 'Extract all check information from this image. Return only JSON.' },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude API error:', errorText);
        return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
      }

      const claudeData = await response.json();
      const content = claudeData.content?.[0]?.text || '';

      let extracted;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        extracted = {};
      }

      // Return extracted data for review (don't save yet)
      return NextResponse.json({
        status: 'extracted',
        data: {
          ...extracted,
          blob_url: blobUrl,
          scan_filename: filename,
        },
      });
    }

    // Handle JSON submission (save to database)
    const data = await request.json();
    
    const {
      maker_name,
      check_number,
      check_amount,
      check_date,
      bank_name,
      routing_number,
      account_number,
      maker_phone,
      maker_address,
      maker_email,
      return_date,
      return_reason,
      notes,
      blob_url,
      scan_filename,
    } = data;

    if (!check_amount) {
      return NextResponse.json({ error: 'check_amount is required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO returned_checks (
        maker_name,
        check_number,
        check_amount,
        check_date,
        bank_name,
        routing_number,
        account_number,
        maker_phone,
        maker_address,
        maker_email,
        return_date,
        return_reason,
        notes,
        blob_url,
        scan_filename,
        status,
        created_at
      ) VALUES (
        ${maker_name || null},
        ${check_number || null},
        ${check_amount},
        ${check_date || null},
        ${bank_name || null},
        ${routing_number || null},
        ${account_number || null},
        ${maker_phone || null},
        ${maker_address || null},
        ${maker_email || null},
        ${return_date || new Date().toISOString().split('T')[0]},
        ${return_reason || 'NSF'},
        ${notes || null},
        ${blob_url || null},
        ${scan_filename || null},
        'uncollected',
        NOW()
      )
      RETURNING check_id
    `;

    return NextResponse.json({
      status: 'success',
      check_id: result.rows[0].check_id,
      message: 'Returned check recorded',
    });

  } catch (error) {
    console.error('Create returned check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update check status or details
export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { check_id, status, notes, maker_phone, maker_email } = data;

    if (!check_id) {
      return NextResponse.json({ error: 'check_id required' }, { status: 400 });
    }

    const resolved_date = status === 'collected' ? new Date().toISOString().split('T')[0] : null;
    
    await sql`
      UPDATE returned_checks SET
        status = COALESCE(${status}, status),
        resolved_date = ${resolved_date},
        notes = COALESCE(${notes}, notes),
        maker_phone = COALESCE(${maker_phone}, maker_phone),
        maker_email = COALESCE(${maker_email}, maker_email),
        updated_at = NOW()
      WHERE check_id = ${check_id}
    `;

    return NextResponse.json({
      status: 'success',
      message: status === 'collected' ? 'Marked as collected' : 'Check updated',
    });

  } catch (error) {
    console.error('Update returned check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a returned check
export async function DELETE(request: NextRequest) {
  try {
    const { check_id } = await request.json();

    if (!check_id) {
      return NextResponse.json({ error: 'check_id required' }, { status: 400 });
    }

    await sql`DELETE FROM returned_check_contacts WHERE check_id = ${check_id}`;
    await sql`DELETE FROM returned_checks WHERE check_id = ${check_id}`;

    return NextResponse.json({
      status: 'success',
      message: 'Check deleted',
    });

  } catch (error) {
    console.error('Delete returned check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
