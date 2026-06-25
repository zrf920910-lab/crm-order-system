import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, ilike, or } from 'drizzle-orm';
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
  try {
    let query = db.select().from(schema.customers).where(eq(schema.customers.userId, uid)).$dynamic();
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
