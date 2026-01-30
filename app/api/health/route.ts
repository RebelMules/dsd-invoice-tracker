import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {
    app: 'ok',
    database: 'unknown',
  };

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW() as time, COUNT(*) as vendors FROM vendors');
      checks.database = `ok (${result.rows[0].vendors} vendors)`;
    } finally {
      client.release();
    }
  } catch (error) {
    checks.database = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const allOk = !Object.values(checks).some(v => v.startsWith('error'));

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 503 });
}
