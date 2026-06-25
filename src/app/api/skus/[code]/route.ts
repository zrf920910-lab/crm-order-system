import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
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
        updatedAt: new Date(),
      })
      .where(eq(schema.skuPrices.id, parseInt(code)))
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
  try {
    const { code } = await params;
    await db.delete(schema.skuPrices).where(eq(schema.skuPrices.id, parseInt(code)));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
