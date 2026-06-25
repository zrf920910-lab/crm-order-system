import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken, getToken, hashUserPassword, verifyPassword } from '@/lib/auth';

// POST: register or login
export async function POST(req: NextRequest) {
  try {
    const { phone, password, action } = await req.json();
    
    if (!phone || !/^\d{11}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的11位手机号' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);

    if (action === 'register') {
      if (user) {
        return NextResponse.json({ error: '该手机号已注册，请直接登录' }, { status: 409 });
      }
      const pwdHash = await hashUserPassword(password);
      const [newUser] = await db.insert(schema.users).values({ phone, passwordHash: pwdHash }).returning();
      const token = await signToken(newUser.id);
      return NextResponse.json({ token, userId: newUser.id, phone: newUser.phone });
    }

    // action === 'login'
    if (!user) {
      return NextResponse.json({ error: '该手机号未注册，请先注册' }, { status: 404 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: '该账号未设置密码，请联系管理员' }, { status: 400 });
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
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
