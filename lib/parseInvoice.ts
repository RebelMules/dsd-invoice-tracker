/**
 * Invoice Parser using Azure OCR + Claude
 * 
 * Flow:
 * 1. Azure Document Intelligence extracts raw text from image/PDF
 * 2. Claude parses the raw text into structured invoice data
 */

export interface InvoiceLineItem {
  upc: string;
  description: string;
  cases: number;
  units: number;
  unitCost: number;
  totalAmount: number;
}

export interface ParsedInvoice {
  vendor: string;
  vendorAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  poNumber?: string;
  subtotal?: number;
  tax?: number;
  total: number;
  lineItems: InvoiceLineItem[];
  rawText: string;
  confidence: number;
}

const AZURE_ENDPOINT = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
const AZURE_KEY = process.env.AZURE_FORM_RECOGNIZER_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Step 1: Extract raw text from invoice using Azure Document Intelligence
 */
export async function extractTextFromInvoice(fileBuffer: Buffer, contentType: string): Promise<string> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) {
    throw new Error('Azure credentials not configured');
  }

  // Start analysis
  const analyzeUrl = `${AZURE_ENDPOINT}/formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`;
  
  // Convert Buffer to Uint8Array for fetch compatibility
  const uint8Array = new Uint8Array(fileBuffer);
  
  const analyzeResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Ocp-Apim-Subscription-Key': AZURE_KEY,
    },
    body: uint8Array,
  });

  if (!analyzeResponse.ok) {
    throw new Error(`Azure OCR failed: ${analyzeResponse.status}`);
  }

  const operationLocation = analyzeResponse.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('No operation location returned from Azure');
  }

  // Poll for results
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const resultResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
    });

    const resultData = await resultResponse.json();
    
    if (resultData.status === 'succeeded') {
      return resultData.analyzeResult?.content || '';
    } else if (resultData.status === 'failed') {
      throw new Error('Azure OCR processing failed');
    }
  }

  throw new Error('Azure OCR timeout');
}

/**
 * Step 2: Parse raw text into structured invoice data using Claude
 */
export async function parseInvoiceText(rawText: string): Promise<ParsedInvoice> {
  const systemPrompt = `You are an expert at parsing grocery and beverage distributor invoices. 
Extract structured data from the invoice text provided.

IMPORTANT:
- UPCs may appear with dashes (0-12000-17186-4) - remove dashes and return as plain digits (012000171864)
- For quantities, distinguish between cases (outer) and units (inner/eaches)
- Calculate unit cost from total amount / units when not explicitly shown
- If a field is not found, use null
- Be precise with numbers - these are financial documents`;

  const userPrompt = `Parse this invoice and return a JSON object with the following structure:
{
  "vendor": "vendor/company name",
  "invoiceNumber": "invoice number",
  "invoiceDate": "YYYY-MM-DD format",
  "total": total amount as number,
  "lineItems": [
    {
      "upc": "UPC with no dashes (12-13 digits)",
      "description": "product description",
      "cases": number of cases,
      "units": total units,
      "unitCost": cost per unit,
      "totalAmount": line total
    }
  ]
}

INVOICE TEXT:
${rawText}

Return ONLY the JSON object, no markdown or explanation.`;

  // Use Claude via Anthropic API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API failed: ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  
  try {
    // Parse the JSON response
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      rawText,
      confidence: 0.95, // Claude is generally very accurate
    };
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${content}`);
  }
}

/**
 * Main function: Process invoice from file to structured data
 */
export async function processInvoice(fileBuffer: Buffer, contentType: string): Promise<ParsedInvoice> {
  // Step 1: OCR
  const rawText = await extractTextFromInvoice(fileBuffer, contentType);
  
  // Step 2: Parse with Claude
  const parsed = await parseInvoiceText(rawText);
  
  return parsed;
}
