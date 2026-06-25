import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';

// GET: get customer prices
// ?customerId=1&skuCode=ABC  -> single SKU price
// ?customerId=1             -> all prices for customer
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const skuCode = searchParams.get('skuCode') || '';
  const skuCodes = searchParams.get('skuCodes') || '';

  if (!customerId) {
    return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  }

  try {
    // Batch query: multiple SKU codes
    if (skuCodes) {
      const codes = skuCodes.split(',').map(c => c.trim()).filter(Boolean);
      const prices = await db
        .select()
        .from(schema.customerPrices)
        .where(
          and(
            eq(schema.customerPrices.customerId, customerId),
            inArray(schema.customerPrices.skuCode, codes)
          )
        );
      const priceMap: Record<string, string> = {};
      prices.forEach(p => { priceMap[p.skuCode] = p.price ?? "0"; });
      return NextResponse.json({ prices: priceMap });
    }

    // Single SKU query
    if (skuCode) {
      const [sku] = await db
        .select()
        .from(schema.skuPrices)
        .where(eq(schema.skuPrices.skuCode, skuCode))
        .limit(1);

      const [customerPrice] = await db
        .select()
        .from(schema.customerPrices)
        .where(
          and(
            eq(schema.customerPrices.customerId, customerId),
            eq(schema.customerPrices.skuCode, skuCode)
          )
        )
        .limit(1);

      return NextResponse.json({
        sku: sku || null,
        customerPrice: customerPrice || null,
      });
    }

    // All prices for customer
    const allPrices = await db
      .select()
      .from(schema.customerPrices)
      .where(eq(schema.customerPrices.customerId, customerId));

    const priceMap: Record<string, string> = {};
    allPrices.forEach(p => { priceMap[p.skuCode] = p.price ?? "0"; });
    return NextResponse.json({ prices: priceMap });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: upsert customer-specific price
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, skuCode, price } = body;

    const [existing] = await db
      .select()
      .from(schema.customerPrices)
      .where(
        and(
          eq(schema.customerPrices.customerId, customerId),
          eq(schema.customerPrices.skuCode, skuCode)
        )
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(schema.customerPrices)
        .set({ price: price.toString(), updatedAt: new Date() })
        .where(eq(schema.customerPrices.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.customerPrices)
        .values({ customerId, skuCode, price: price.toString() })
        .returning();
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
