import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  try {
    // Get invoice count for this week
    const weeklyCount = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // Get pending approvals
    const pendingCount = await queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE payment_status IN ('pending', 'needs_review')
    `);

    // Get monthly total processed
    const monthlyTotal = await queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices 
      WHERE created_at >= DATE_TRUNC('month', NOW())
        AND payment_status NOT IN ('pending', 'needs_review')
    `);

    // Get active vendors count
    const vendorCount = await queryOne<{ count: string }>(`
      SELECT COUNT(DISTINCT vendor_id) as count FROM invoices 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Get recent activity
    const recentActivity = await query<{
      invoice_id: number;
      invoice_number: string;
      vendor_name: string;
      total_amount: number;
      payment_status: string;
      created_at: Date;
    }>(`
      SELECT 
        i.invoice_id,
        i.invoice_number,
        v.name as vendor_name,
        i.total_amount,
        i.payment_status,
        i.created_at
      FROM invoices i
      JOIN vendors v ON i.vendor_id = v.vendor_id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    return NextResponse.json({
      stats: {
        weeklyInvoices: parseInt(weeklyCount?.count || '0'),
        pendingApprovals: parseInt(pendingCount?.count || '0'),
        monthlyProcessed: parseFloat(monthlyTotal?.total || '0'),
        activeVendors: parseInt(vendorCount?.count || '0'),
      },
      recentActivity: recentActivity.map(item => ({
        id: item.invoice_id,
        invoiceNumber: item.invoice_number,
        vendor: item.vendor_name,
        amount: item.total_amount,
        status: item.payment_status,
        time: item.created_at,
      })),
    });

  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to load stats', details: String(error) },
      { status: 500 }
    );
  }
}
