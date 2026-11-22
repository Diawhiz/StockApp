import { NextResponse } from 'next/server';

// The single allowed account
const VALID_USERNAME = 'admin';
const VALID_PASSWORD = 'sage2024';

/**
 * Login endpoint
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { success, token }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password required' },
        { status: 400 }
      );
    }

    if (username !== VALID_USERNAME) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (password !== VALID_PASSWORD) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate a simple JWT-like token
    const token = btoa(`${username}:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`);

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('Auth error:', error.message);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check auth endpoint (for verification)
 * GET /api/auth/check
 * Header: Authorization: Bearer <token>
 * Returns: { valid }
 */
export async function GET(req) {
  try {
    const { headers } = req;
    const authHeader = headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    // Decode the token (basic atob for our format)
    let decoded;
    try {
      decoded = atob(token);
    } catch {
      return NextResponse.json({ valid: false });
    }

    // Verify format: "username:timestamp:random"
    const parts = decoded.split(':');
    if (parts.length !== 3) {
      return NextResponse.json({ valid: false });
    }

    const username = parts[0];
    const timestamp = parseInt(parts[1], 10);

    // Token expires after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ valid: false, expired: true });
    }

    if (username !== VALID_USERNAME) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, username });
  } catch (error) {
    console.error('Auth check error:', error.message);
    return NextResponse.json({ valid: false });
  }
}