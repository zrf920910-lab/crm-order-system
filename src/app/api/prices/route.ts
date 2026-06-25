import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const skuName = searchParams.get('skuName') || '';

  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }

  try {
    if (skuName) {
      const [sku] = await db
        .select()
        .from(schema.skuPrices)
        .where(eq(schema.skuPrices.skuName, skuName))
        .limit(1);
      const [customerPrice] = await db
        .select()
        .from(schema.customerPrices)
        .where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.skuName, skuName)))
        .limit(1);
      return NextResponse.json({ sku: sku || null, customerPrice: customerPrice || null });
    }

    const allPrices = await db
      .select()
      .from(schema.customerPrices)
      .where(eq(schema.customerPrices.customerId, customerId));
    const priceMap: Record<string, string> = {};
    allPrices.forEach(p => { priceMap[p.skuName] = p.price ?? '0'; });
    return NextResponse.json({ prices: priceMap });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, skuName, price } = body;
    const [existing] = await db
      .select()
      .from(schema.customerPrices)
      .where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.skuName, skuName)))
      .limit(1);
    let result;
    if (existing) {
      [result] = await db.update(schema.customerPrices).set({ price, updatedAt: new Date() }).where(eq(schema.customerPrices.id, existing.id)).returning();
    } else {
      [result] = await db.insert(schema.customerPrices).values({ customerId, skuName, price }).returning();
    }
    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
