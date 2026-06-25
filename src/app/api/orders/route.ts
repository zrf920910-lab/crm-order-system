import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUid(req: NextRequest) { const t = getToken(req); if (!t) return null; return verifyToken(t); }

export async function GET(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const limit = parseInt(searchParams.get('limit') || '50');
  try {
    let q = db.select({ order: schema.orders, customer: schema.customers }).from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .where(eq(schema.orders.userId, uid)).orderBy(desc(schema.orders.createdAt)).limit(limit).$dynamic();
    if (customerId) q = q.where(eq(schema.orders.customerId, customerId));
    return NextResponse.json(await q);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { customerId, items, notes, stampImage, orderNumber } = body;
    const totalAmount = items.reduce((s: number, i: any) => s + parseFloat(i.unitPrice) * parseFloat(i.quantity), 0).toFixed(2);
    const [order] = await db.insert(schema.orders).values({ userId: uid, customerId, totalAmount, notes: notes || '', stampImage: stampImage || '', orderNumber: orderNumber || `ORD-${Date.now()}` }).returning();
    await db.insert(schema.orderItems).values(items.map((i: any) => ({
      orderId: order.id, skuName: i.skuName, brand: i.brand || '', unit: i.unit || '',
      quantity: i.quantity.toString(), unitPrice: i.unitPrice.toString(),
      total: (parseFloat(i.unitPrice) * parseFloat(i.quantity)).toFixed(2),
    })));
    const eps = await db.select().from(schema.customerPrices).where(and(eq(schema.customerPrices.customerId, customerId), eq(schema.customerPrices.userId, uid)));
    for (const item of items) {
      const ep = eps.find(p => p.skuName === item.skuName);
      if (ep) await db.update(schema.customerPrices).set({ price: item.unitPrice.toString(), updatedAt: new Date() }).where(eq(schema.customerPrices.id, ep.id));
      else await db.insert(schema.customerPrices).values({ userId: uid, customerId, skuName: item.skuName, price: item.unitPrice.toString() });
    }
    const oi = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    return NextResponse.json({ ...order, items: oi }, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
