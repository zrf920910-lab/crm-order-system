import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken, getToken } from '@/lib/auth';

// POST: register or login
export async function POST(req: NextRequest) {
  try {
    const { phone, action } = await req.json();
    if (!phone || !/^\d{11}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的11位手机号' }, { status: 400 });
    }

    // Find or create user
    let [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
    
    if (!user) {
      if (action === 'login') {
        return NextResponse.json({ error: '该手机号未注册，请先注册' }, { status: 404 });
      }
      [user] = await db.insert(schema.users).values({ phone }).returning();
    }

    const token = await signToken(user.id);
    return NextResponse.json({ token, userId: user.id, phone: user.phone });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: verify token
export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ valid: false }, { status: 401 });
  const userId = await verifyToken(token);
  return NextResponse.json({ valid: !!userId, userId });
}
