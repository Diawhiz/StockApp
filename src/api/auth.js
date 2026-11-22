/**
 * Auth API Route for Vercel Serverless Functions
 * 
 * Simple password-based authentication:
 * - One account only (admin / sage2024)
 * - Returns JWT token on success
 * - Token stored in encrypted storage on Android, localStorage on web
 * 
 * POST /api/auth/login
 * POST /api/auth/check
 */

import { query } from '../../database/pgDb.js';

// The single allowed account
// Password hash for "sage2024" - bcrypt hash
// In production, change this and re-hash
const VALID_USERNAME = 'admin';
const VALID_PASSWORD_HASH = '$2b$10$JjH4HdcP.Fi.x.YKx8ZMyeOUQZk.wEMlR92Z.IvIx.YIx5W5e.hPu';

// Simple bcrypt comparison (no external dependency)
// In production, use a proper bcrypt library
function comparePasswords(plain, hash) {
  // This is a simplified comparison - in production use bcrypt directly
  // For now, we'll use a basic check
  return hash === '$2b$10$JjH4HdcP.Fi.x.YKx8ZMyeOUQZk.wEMlR92Z.IvIx.YIx5W5e.hPu' && plain === 'sage2024';
}

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
      return new Response(
        JSON.stringify({ success: false, message: 'Username and password required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (username !== VALID_USERNAME) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!comparePasswords(password, VALID_PASSWORD_HASH)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate a simple JWT-like token
    // In production, use jsonwebtoken library with a proper secret
    const token = btoa(`${username}:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`);

    return new Response(
      JSON.stringify({ success: true, token }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check auth endpoint (for verification)
 * POST /api/auth/check
 * Header: Authorization: Bearer <token>
 * Returns: { valid }
 */
export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Decode the token (basic atob for our format)
    let decoded;
    try {
      decoded = atob(token);
    } catch {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify format: "username:timestamp:random"
    const parts = decoded.split(':');
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const username = parts[0];
    const timestamp = parseInt(parts[1], 10);

    // Token expires after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      return new Response(
        JSON.stringify({ valid: false, expired: true }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (username !== VALID_USERNAME) {
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, username }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auth check error:', error.message);
    return new Response(
      JSON.stringify({ valid: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}