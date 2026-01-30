import { NextRequest, NextResponse } from 'next/server';

const AZURE_ENDPOINT = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
const AZURE_KEY = process.env.AZURE_FORM_RECOGNIZER_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('invoice') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check credentials
    if (!AZURE_ENDPOINT || !AZURE_KEY) {
      return NextResponse.json({ error: 'Azure credentials not configured' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ===== STEP 1: Azure OCR =====
    const analyzeUrl = `${AZURE_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`;
    
    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/pdf',
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
      },
      body: buffer,
    });

    if (!analyzeResponse.ok) {
      return NextResponse.json({ error: 'Azure OCR failed to start' }, { status: 500 });
    }

    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      return NextResponse.json({ error: 'No operation location' }, { status: 500 });
    }

    // Poll for OCR results
    let rawText = '';
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
      });

      const resultData = await resultResponse.json();
      
      if (resultData.status === 'succeeded') {
        rawText = resultData.analyzeResult?.content || '';
        break;
      } else if (resultData.status === 'failed') {
        return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: 'OCR timeout' }, { status: 504 });
    }

    // ===== STEP 2: Claude Parsing =====
    if (!ANTHROPIC_API_KEY) {
      // Return raw text without parsing if no Claude key
      return NextResponse.json({
        status: 'partial',
        rawText,
        parsed: null,
        message: 'OCR complete, but Claude API key not configured for parsing'
      });
    }

    const systemPrompt = `You are an expert at parsing grocery and beverage distributor invoices. Extract structured data from invoice text. Return ONLY valid JSON, no markdown or explanation.

RULES:
- UPCs: Remove dashes, return as plain digits (e.g., 0-12000-17186-4 → 012000171864)
- Dates: Use YYYY-MM-DD format
- Numbers: Return as numbers, not strings
- If field not found, use null`;

    const userPrompt = `Parse this invoice into JSON:
{
  "vendor": "string",
  "invoiceNumber": "string", 
  "invoiceDate": "YYYY-MM-DD",
  "total": number,
  "lineItems": [
    {"upc": "string (no dashes)", "description": "string", "cases": number, "units": number, "totalAmount": number}
  ]
}

INVOICE:
${rawText}`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      return NextResponse.json({
        status: 'partial',
        rawText,
        parsed: null,
        message: 'OCR complete, but Claude parsing failed'
      });
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content?.[0]?.text || '';

    let parsed;
    try {
      // Try to extract JSON from response (handle markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    return NextResponse.json({
      status: 'success',
      rawText,
      parsed,
    });

  } catch (error) {
    console.error('Process invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
