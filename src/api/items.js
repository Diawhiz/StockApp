/**
 * Items API Route for Vercel Serverless Functions
 * 
 * CRUD operations for vendor items (add, edit, delete)
 * Accessible after auth
 * 
 * GET /api/items?vendorId=id - List items for a vendor
 * POST /api/items - Create new item
 * PATCH /api/items/:id - Update item
 * DELETE /api/items/:id - Delete item
 */

import { query } from '../../database/pgDb.js';

// Middleware: auth check
async function withAuthHandler(fn) {
  return async (req) => {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
 * GET /api/items?vendorId=id - List items for a specific vendor
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');

    const { sql } = await import('../../database/pgDb.js');

    let items;
    if (vendorId) {
      items = await sql`
        SELECT id, vendor_id, name, price, expected, actual, created_at, updated_at, last_sync_at, sync_event_id
        FROM vendor_items
        WHERE vendor_id = ${vendorId}
        ORDER BY name COLLATE "C" ASC
      `;
    } else {
      items = await sql`
        SELECT id, vendor_id, name, price, expected, actual, created_at, updated_at, last_sync_at, sync_event_id
        FROM vendor_items
        ORDER BY created_at ASC
      `;
    }

    const result = items.map((item) => ({
      id: item.id,
      vendor_id: item.vendor_id,
      name: item.name,
      price: item.price / 100, // Convert from cents to dollars
      expected: item.expected,
      actual: item.actual,
      missing: (item.expected || 0) - (item.actual || 0),
      last_sync_at: item.last_sync_at,
      sync_event_id: item.sync_event_id,
    }));

    return new Response(
      JSON.stringify({ success: true, items: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET /api/items error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/items - Create new item for a vendor
 * Body: { vendorId, name, price, expected, actual }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { vendorId, name, price, expected, actual } = body;

    if (!vendorId || !name || name.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Vendor ID and item name are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = name.trim();
    const parsedPrice = price !== undefined ? Math.max(0, Math.floor(parseFloat(price) * 100)) : 0; // cents
    const parsedExpected = expected !== undefined ? Math.max(0, Math.floor(parseFloat(expected))) : 0;
    const parsedActual = actual !== undefined ? Math.max(0, Math.floor(parseFloat(actual))) : 0;

    const { sql } = await import('../../database/pgDb.js');

    // Check if item already exists for this vendor
    const existing = await sql`
      SELECT id FROM vendor_items WHERE vendor_id = ${vendorId} AND name = ${trimmedName} COLLATE "C"
    `;

    if (existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: `Item "${trimmedName}" already exists for this vendor.` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new item
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO vendor_items (id, vendor_id, name, price, expected, actual, created_at, updated_at, last_sync_at, sync_event_id)
      VALUES (${id}, ${vendorId}, ${trimmedName}, ${parsedPrice}, ${parsedExpected}, ${parsedActual}, ${now}, ${now}, ${now}, ${crypto.randomUUID()})
    `;

    return new Response(
      JSON.stringify({ 
        success: true, 
        item: { 
          id, 
          vendor_id: vendorId, 
          name: trimmedName, 
          price: parsedPrice / 100, 
          expected: parsedExpected, 
          actual: parsedActual,
          missing: parsedExpected - parsedActual,
          last_sync_at: now,
          sync_event_id: crypto.randomUUID() 
        } 
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/items error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PATCH /api/items/:id - Update item (inline editing)
 * Body: { expected, actual, price }
 * Query: id = item ID
 */
export async function PATCH(req) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Item ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { expected, actual, price } = body;

    const { sql } = await import('../../database/pgDb.js');
    const now = new Date().toISOString();

    // Build update dynamically
    const setClauses = [];
    const params = [];

    if (expected !== undefined) {
      setClauses.push(`expected = ${Math.max(0, Math.floor(parseFloat(expected)))}`);
    }
    if (actual !== undefined) {
      setClauses.push(`actual = ${Math.max(0, Math.floor(parseFloat(actual)))}`);
    }
    if (price !== undefined) {
      setClauses.push(`price = ${Math.max(0, Math.floor(parseFloat(price) * 100))}`); // cents
    }

    setClauses.push(`updated_at = ${sql.now()}`);
    params.push(itemId);

    const updateQuery = `
      UPDATE vendor_items
      SET ${setClauses.join(', ')}
      WHERE id = ${itemId}
    `;

    await sql(updateQuery);

    // Return updated item
    const item = await sql`
      SELECT id, vendor_id, name, price, expected, actual, last_sync_at, sync_event_id
      FROM vendor_items
      WHERE id = ${itemId}
    `;

    const result = item[0] ? {
      id: item[0].id,
      vendor_id: item[0].vendor_id,
      name: item[0].name,
      price: item[0].price / 100,
      expected: item[0].expected,
      actual: item[0].actual,
      missing: (item[0].expected || 0) - (item[0].actual || 0),
      last_sync_at: item[0].last_sync_at,
      sync_event_id: item[0].sync_event_id,
    } : null;

    return new Response(
      JSON.stringify({ success: true, item: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PATCH /api/items error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/items/:id - Delete item
 * Query: ?confirm=true
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');
    const confirm = searchParams.get('confirm');

    if (!itemId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Item ID required' }),
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

    const result = await sql`DELETE FROM vendor_items WHERE id = ${itemId}`;

    if (result.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Item not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Item deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('DELETE /api/items error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}