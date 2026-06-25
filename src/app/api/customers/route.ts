import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, ilike, or, and, inArray } from 'drizzle-orm';
import { verifyToken, getToken } from '@/lib/auth';

async function getUserId(req: NextRequest) {
  const token = getToken(req); if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const uid = await getUserId(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50');
  const showDeleted = searchParams.get('deleted') === '1';
  try {
    let query = db.select().from(schema.customers).where(and(
      eq(schema.customers.userId, uid),
      eq(schema.customers.deleted, showDeleted),
    )).$dynamic();
    if (q) query = query.where(or(ilike(schema.customers.name, `%${q}%`), ilike(schema.customers.phone, `%${q}%`)));
    return NextResponse.json(await query.limit(limit).orderBy(schema.customers.updatedAt));
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const uid = await getUserId(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const [c] = await db.insert(schema.customers).values({ userId: uid, name: body.name, phone: body.phone || '', address: body.address || '' }).returning();
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  const uid = await getUserId(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const ids = (searchParams.get('ids') || '').split(',').map(Number).filter(n => !isNaN(n));
    if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    const restore = searchParams.get('restore') === '1';
    const permanent = searchParams.get('permanent') === '1';
    if (permanent) {
      for (const id of ids) {
        await db.delete(schema.customerPrices).where(eq(schema.customerPrices.customerId, id));
      }
      await db.delete(schema.customers).where(and(inArray(schema.customers.id, ids), eq(schema.customers.userId, uid)));
    } else {
      await db.update(schema.customers).set({ deleted: !restore, updatedAt: new Date() }).where(and(inArray(schema.customers.id, ids), eq(schema.customers.userId, uid)));
    }
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
