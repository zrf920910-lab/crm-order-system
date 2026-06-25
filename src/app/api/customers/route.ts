import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, ilike, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const result = q
      ? await db
          .select()
          .from(schema.customers)
          .where(
            or(
              ilike(schema.customers.name, `%${q}%`),
              ilike(schema.customers.phone, `%${q}%`)
            )
          )
          .limit(limit)
          .orderBy(schema.customers.updatedAt)
      : await db
          .select()
          .from(schema.customers)
          .limit(limit)
          .orderBy(schema.customers.updatedAt);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [customer] = await db
      .insert(schema.customers)
      .values({
        name: body.name,
        phone: body.phone || '',
        address: body.address || '',
        notes: body.notes || '',
      })
      .returning();
    return NextResponse.json(customer, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
