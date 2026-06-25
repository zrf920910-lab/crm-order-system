import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    let query = db
      .select({
        order: schema.orders,
        customer: schema.customers,
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .$dynamic();

    if (customerId) {
      query = query.where(eq(schema.orders.customerId, customerId));
    }

    const result = await query;
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, items, notes, stampImage, orderNumber } = body;

    const totalAmount = items
      .reduce((sum: number, item: any) => sum + (parseFloat(item.unitPrice) * parseFloat(item.quantity)), 0)
      .toFixed(2);

    const [order] = await db
      .insert(schema.orders)
      .values({
        customerId,
        totalAmount,
        notes: notes || '',
        stampImage: stampImage || '',
        orderNumber: orderNumber || `ORD-${Date.now()}`,
      })
      .returning();

    const orderItemsData = items.map((item: any) => ({
      orderId: order.id,
      skuCode: item.skuCode,
      skuName: item.skuName,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      total: (parseFloat(item.unitPrice) * parseFloat(item.quantity)).toFixed(2),
    }));

    await db.insert(schema.orderItems).values(orderItemsData);

    // Upsert customer-specific prices
    const existingPrices = await db
      .select()
      .from(schema.customerPrices)
      .where(eq(schema.customerPrices.customerId, customerId));

    for (const item of items) {
      const existingPrice = existingPrices.find(p => p.skuCode === item.skuCode);
      if (existingPrice) {
        await db
          .update(schema.customerPrices)
          .set({ price: item.unitPrice.toString(), updatedAt: new Date() })
          .where(eq(schema.customerPrices.id, existingPrice.id));
      } else {
        await db
          .insert(schema.customerPrices)
          .values({
            customerId,
            skuCode: item.skuCode,
            price: item.unitPrice.toString(),
          });
      }
    }

    const orderItemsResult = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));

    return NextResponse.json(
      { ...order, items: orderItemsResult },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
