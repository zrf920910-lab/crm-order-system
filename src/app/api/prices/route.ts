import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUid(req: NextRequest) { const t = getToken(req); if (!t) return null; return verifyToken(t); }

export async function GET(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const skuName = searchParams.get('skuName') || '';
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
  try {
    if (skuName) {
      const [sku] = await db.select().from(schema.skuPrices).where(and(eq(schema.skuPrices.skuName, skuName), eq(schema.skuPrices.userId, uid))).limit(1);
      const [cp] = await db.select().from(schema.customerPrices).where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.skuName, skuName), eq(schema.customerPrices.userId, uid))).limit(1);
      return NextResponse.json({ sku: sku || null, customerPrice: cp || null });
    }
    const all = await db.select().from(schema.customerPrices).where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.userId, uid)));
    const pm: Record<string, string> = {}; all.forEach(p => { pm[p.skuName] = p.price ?? '0'; });
    return NextResponse.json({ prices: pm });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { customerId, skuName, price } = body;
    const [ex] = await db.select().from(schema.customerPrices).where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.skuName, skuName), eq(schema.customerPrices.userId, uid))).limit(1);
    let r;
    if (ex) [r] = await db.update(schema.customerPrices).set({ price, updatedAt: new Date() }).where(eq(schema.customerPrices.id, ex.id)).returning();
    else [r] = await db.insert(schema.customerPrices).values({ userId: uid, customerId, skuName, price }).returning();
    return NextResponse.json(r, { status: ex ? 200 : 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
