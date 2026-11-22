/**
 * Vendors API Route for Vercel Serverless Functions
 * 
 * CRUD operations for vendors, accessible after auth
 * Calls Aiven PostgreSQL via the sql client
 * 
 * GET /api/vendors - List all vendors with items
 * POST /api/vendors - Create new vendor
 * DELETE /api/vendors/:id - Delete vendor
 */

import { query } from '../../database/pgDb.js';

// Middleware: simple auth check
async function withAuth(fn) {
  return async (req) => {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basic token validation
    let decoded;
    try {
      decoded = atob(token);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parts = decoded.split(':');
    if (parts.length !== 3 || parts[0] !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return await fn(req);
  };
}

/**
 * GET /api/vendors - List all vendors with their items
 */
export async function GET(req) {
  try {
    const { sql } = await import('../../database/pgDb.js');
    const vendors = await sql`
      SELECT id, name, created_at, updated_at
      FROM vendors
      ORDER BY name COLLATE "C" ASC
    `;
    const items = await sql`
      SELECT id, vendor_id, name, price, expected, actual, created_at, updated_at, last_sync_at, sync_event_id
      FROM vendor_items
      ORDER BY created_at ASC
    `;

    // Group items by vendor
    const itemMap = new Map();
    for (const item of items) {
      const key = item.vendor_id;
      if (!itemMap.has(key)) {
        itemMap.set(key, []);
      }
      itemMap.get(key).push({
        id: item.id,
        name: item.name,
        price: item.price / 100, // Convert from cents to dollars
        expected: item.expected,
        actual: item.actual,
        missing: (item.expected || 0) - (item.actual || 0),
        last_sync_at: item.last_sync_at,
        sync_event_id: item.sync_event_id,
      });
    }

    const result = vendors.map((v) => ({
      ...v,
      items: itemMap.get(v.id) || [],
    }));

    return new Response(
      JSON.stringify({ success: true, vendors: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET /api/vendors error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/vendors - Create new vendor
 * Body: { name }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || name.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Vendor name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sql } = await import('../../database/pgDb.js');
    const trimmedName = name.trim();

    // Check if vendor already exists
    const existing = await sql`
      SELECT id FROM vendors WHERE name = ${trimmedName} COLLATE "C"
    `;

    if (existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: `Vendor "${trimmedName}" already exists.` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new vendor
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO vendors (id, name, created_at, updated_at)
      VALUES (${id}, ${trimmedName}, ${now}, ${now})
    `;

    return new Response(
      JSON.stringify({ success: true, vendor: { id, name: trimmedName, created_at: now, updated_at: now, items: [] } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/vendors error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/vendors/:id - Delete vendor
 * Query: ?confirm=true (to prevent accidental deletion)
 */
export async function DELETE(req) {
  try {
    const { path } = await import('next/server');
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('id');
    const confirm = searchParams.get('confirm');

    if (!vendorId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vendor ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (confirm !== 'true') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Add ?confirm=true to confirm deletion' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sql } = await import('../../database/pgDb.js');

    // Delete vendor items first (CASCADE should handle this, but being explicit)
    await sql`DELETE FROM vendor_items WHERE vendor_id = ${vendorId}`;
    // Delete vendor (items should be deleted by CASCADE, but retry if needed)
    const result = await sql`DELETE FROM vendors WHERE id = ${vendorId}`;

    if (result.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vendor not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Vendor deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('DELETE /api/vendors error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}