import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, ilike, or, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const letter = searchParams.get('letter') || '';

  try {
    let query = db.select().from(schema.skuPrices).$dynamic();
    
    if (q) {
      query = query.where(
        or(
          ilike(schema.skuPrices.skuCode, `%${q}%`),
          ilike(schema.skuPrices.skuName, `%${q}%`)
        )
      );
    }
    if (letter) {
      query = query.where(ilike(schema.skuPrices.skuName, `${letter}%`));
    }
    
    const result = await query.orderBy(asc(schema.skuPrices.skuName)).limit(200);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [sku] = await db
      .insert(schema.skuPrices)
      .values({
        skuCode: body.skuCode,
        skuName: body.skuName,
        costPrice: body.costPrice || '0',
        unit: body.unit || '',
      })
      .returning();
    return NextResponse.json(sku, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
