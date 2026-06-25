import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUid(req: NextRequest) { const t = getToken(req); if (!t) return null; return verifyToken(t); }

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { code } = await params;
    const body = await req.json();
    const [sku] = await db
      .update(schema.skuPrices)
      .set({
        skuName: body.skuName,
        brand: body.brand,
        costPrice: body.costPrice,
        unit: body.unit,
        params: body.params || '',
        updatedAt: new Date(),
      })
      .where(and(eq(schema.skuPrices.id, parseInt(code)), eq(schema.skuPrices.userId, uid)))
      .returning();
    if (!sku) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(sku);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { code } = await params;
    await db.delete(schema.skuPrices).where(and(eq(schema.skuPrices.id, parseInt(code)), eq(schema.skuPrices.userId, uid)));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
