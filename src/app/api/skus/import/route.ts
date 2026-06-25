import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUid(req: NextRequest) { const t = getToken(req); if (!t) return null; return verifyToken(t); }

export async function POST(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { rows } = body; // rows: { skuName, brand?, costPrice?, unit? }[]
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '请提供有效的SKU数据' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = (row.skuName || row.name || '').trim();
      if (!name) { skipped++; continue; }
      
      // Check if SKU already exists for this user
      const [existing] = await db.select().from(schema.skuPrices)
        .where(and(eq(schema.skuPrices.skuName, name), eq(schema.skuPrices.userId, uid)))
        .limit(1);
      
      if (existing) { skipped++; continue; }

      await db.insert(schema.skuPrices).values({
        userId: uid,
        skuName: name,
        brand: (row.brand || '').trim(),
        costPrice: String(row.costPrice || row.price || '0'),
        unit: (row.unit || '').trim(),
      });
      imported++;
    }

    // Also restore any matching deleted SKUs
    return NextResponse.json({ imported, skipped, total: imported + skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
