import { NextRequest, NextResponse } from 'next/server';

// Azure Form Recognizer configuration
const AZURE_ENDPOINT = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
const AZURE_KEY = process.env.AZURE_FORM_RECOGNIZER_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('invoice') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check Azure credentials
    if (!AZURE_ENDPOINT || !AZURE_KEY) {
      // Return mock data for development
      return NextResponse.json({
        status: 'success',
        data: {
          vendor: 'Sample Vendor',
          invoiceNumber: 'INV-' + Date.now(),
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: null,
          subtotal: 0,
          tax: 0,
          total: 0,
          lineItems: [],
          confidence: 0,
          rawText: '[Development mode - Azure credentials not configured]',
        },
        mock: true,
      });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Call Azure Form Recognizer - prebuilt invoice model
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
      const error = await analyzeResponse.text();
      console.error('Azure analyze error:', error);
      return NextResponse.json({ error: 'OCR analysis failed' }, { status: 500 });
    }

    // Get operation location for polling
    const operationLocation = analyzeResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      return NextResponse.json({ error: 'No operation location returned' }, { status: 500 });
    }

    // Poll for results (Azure Form Recognizer is async)
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
        },
      });

      const resultData = await resultResponse.json();
      
      if (resultData.status === 'succeeded') {
        result = resultData;
        break;
      } else if (resultData.status === 'failed') {
        return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
      }
      // Continue polling if 'running'
    }

    if (!result) {
      return NextResponse.json({ error: 'OCR timeout' }, { status: 504 });
    }

    // Extract invoice fields
    const document = result.analyzeResult?.documents?.[0];
    const fields = document?.fields || {};

    const extractedData = {
      vendor: fields.VendorName?.content || fields.VendorName?.valueString || null,
      vendorAddress: fields.VendorAddress?.content || null,
      invoiceNumber: fields.InvoiceId?.content || fields.InvoiceId?.valueString || null,
      invoiceDate: fields.InvoiceDate?.content || fields.InvoiceDate?.valueDate || null,
      dueDate: fields.DueDate?.content || fields.DueDate?.valueDate || null,
      purchaseOrder: fields.PurchaseOrder?.content || null,
      subtotal: fields.SubTotal?.valueCurrency?.amount || null,
      tax: fields.TotalTax?.valueCurrency?.amount || null,
      total: fields.InvoiceTotal?.valueCurrency?.amount || null,
      lineItems: (fields.Items?.valueArray || []).map((item: any) => ({
        description: item.valueObject?.Description?.content || null,
        productCode: item.valueObject?.ProductCode?.content || null,
        quantity: item.valueObject?.Quantity?.valueNumber || null,
        unit: item.valueObject?.Unit?.content || null,
        unitPrice: item.valueObject?.UnitPrice?.valueCurrency?.amount || null,
        amount: item.valueObject?.Amount?.valueCurrency?.amount || null,
      })),
      confidence: document?.confidence || 0,
      rawText: result.analyzeResult?.content || '',
    };

    return NextResponse.json({
      status: 'success',
      data: extractedData,
    });

  } catch (error) {
    console.error('OCR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
