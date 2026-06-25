import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { ilike, or, asc, eq, inArray, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const letter = searchParams.get('letter') || '';
  const deleted = searchParams.get('deleted') === '1';

  try {
    let query = db.select().from(schema.skuPrices).$dynamic();

    // Filter: only show non-deleted by default
    query = query.where(eq(schema.skuPrices.deleted, deleted));

    if (q) {
      query = query.where(
        or(ilike(schema.skuPrices.skuName, `%${q}%`), ilike(schema.skuPrices.brand, `%${q}%`))
      );
    } else if (letter) {
      query = query.where(ilike(schema.skuPrices.skuName, `${letter}%`));
    }

    const result = await query.orderBy(asc(schema.skuPrices.skuName)).limit(500);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [sku] = await db.insert(schema.skuPrices).values({
      skuName: body.skuName,
      brand: body.brand || '',
      costPrice: body.costPrice || '0',
      unit: body.unit || '',
    }).returning();
    return NextResponse.json(sku, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: batch soft-delete
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids') || '';
    const restore = searchParams.get('restore') === '1';
    const permanent = searchParams.get('permanent') === '1';

    if (!ids) return NextResponse.json({ error: 'ids required' }, { status: 400 });

    const idList = ids.split(',').map(Number).filter(n => !isNaN(n));
    if (idList.length === 0) return NextResponse.json({ error: 'invalid ids' }, { status: 400 });

    if (permanent) {
      await db.delete(schema.skuPrices).where(inArray(schema.skuPrices.id, idList));
    } else {
      await db.update(schema.skuPrices)
        .set({ deleted: !restore, updatedAt: new Date() })
        .where(inArray(schema.skuPrices.id, idList));
    }

    return NextResponse.json({ success: true, count: idList.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
