import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { ilike, or, asc, eq, inArray, and, notIlike, sql } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUid(req: NextRequest) { const t = getToken(req); if (!t) return null; return verifyToken(t); }

export async function GET(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const letter = searchParams.get('letter') || '';
  const deleted = searchParams.get('deleted') === '1';
  try {
    let query = db.select().from(schema.skuPrices).where(and(eq(schema.skuPrices.userId, uid), eq(schema.skuPrices.deleted, deleted))).$dynamic();
    if (q) {
      query = query.where(or(ilike(schema.skuPrices.skuName, `%${q}%`), ilike(schema.skuPrices.brand, `%${q}%`)));
    } else if (letter === '#') {
      // Match names that do NOT start with A-Z or 0-9
      query = query.where(sql`${schema.skuPrices.skuName} !~ '^[A-Za-z0-9]'`);
    } else if (letter === '0-9') {
      // Match names starting with a digit
      query = query.where(sql`${schema.skuPrices.skuName} ~ '^[0-9]'`);
    } else if (letter) {
      query = query.where(ilike(schema.skuPrices.skuName, `${letter}%`));
    }
    return NextResponse.json(await query.orderBy(asc(schema.skuPrices.skuName)).limit(500));
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const [sku] = await db.insert(schema.skuPrices).values({ userId: uid, skuName: body.skuName, brand: body.brand || '', costPrice: body.costPrice || '0', unit: body.unit || '' }).returning();
    return NextResponse.json(sku, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const ids = (searchParams.get('ids') || '').split(',').map(Number).filter(n => !isNaN(n));
    if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    const restore = searchParams.get('restore') === '1';
    const permanent = searchParams.get('permanent') === '1';
    if (permanent) await db.delete(schema.skuPrices).where(and(inArray(schema.skuPrices.id, ids), eq(schema.skuPrices.userId, uid)));
    else await db.update(schema.skuPrices).set({ deleted: !restore, updatedAt: new Date() }).where(and(inArray(schema.skuPrices.id, ids), eq(schema.skuPrices.userId, uid)));
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}