/**
 * Deliveries API Route for Vercel Serverless Functions
 * 
 * Handles delivery creation with stock deduction from both actual and expected
 * Accessible after auth
 * 
 * GET /api/deliveries - List all deliveries
 * POST /api/deliveries - Create new delivery (deducts stock)
 * DELETE /api/deliveries/:id - Delete delivery (restores stock)
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
 * GET /api/deliveries - List all deliveries with items
 */
export async function GET(req) {
  try {
    const { sql } = await import('../../database/pgDb.js');

    const deliveries = await sql`
      SELECT id, date, location, rider, product_details, price_cents / 100 AS price_dollars,
             fee_cents / 100 AS fee_dollars, created_at, updated_at
      FROM deliveries
      ORDER BY created_at DESC
    `;

    // Get items for each delivery
    const deliveryIds = deliveries.map((d) => d.id);
    
    let items = [];
    if (deliveryIds.length > 0) {
      const placeholders = deliveryIds.map(() => '?').join(',');
      items = await sql`
        SELECT * FROM delivery_items
        WHERE delivery_id IN (${sql(placeholders)})
        ORDER BY created_at ASC
      `;
    }

    // Group items by delivery
    const itemMap = new Map();
    for (const item of items) {
      if (!itemMap.has(item.delivery_id)) {
        itemMap.set(item.delivery_id, []);
      }
      itemMap.get(item.delivery_id).push({
        id: item.id,
        vendor_id: item.vendor_id,
        item_id: item.item_id,
        vendor_name_snapshot: item.vendor_name_snapshot,
        item_name_snapshot: item.item_name_snapshot,
        unit_price_cents: item.unit_price_cents,
        quantity: item.quantity,
        created_at: item.created_at,
      });
    }

    const result = deliveries.map((d) => ({
      ...d,
      items: itemMap.get(d.id) || [],
    }));

    return new Response(
      JSON.stringify({ success: true, deliveries: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET /api/deliveries error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/deliveries - Create new delivery
 * Body: { date, location, rider, product, price, fee, items[] }
 * Each item: { vendor_id, item_id, quantity }
 * Returns: delivery ID
 * 
 * This deducts from BOTH actual and expected stock in vendor_items
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { date, location, rider, product, price, fee, items = [] } = body;

    // Validation
    if (!location || location.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Location is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!rider || rider.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Rider name is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!product || product.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Product/details is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!date) {
      return new Response(
        JSON.stringify({ success: false, message: 'Date is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsedPrice = price !== undefined ? Math.max(0, Math.floor(parseFloat(price) * 100)) : 0;
    const parsedFee = fee !== undefined ? Math.max(0, Math.floor(parseFloat(fee) * 100)) : 0;

    const trimmedLocation = location.trim();
    const trimmedRider = rider.trim();
    const trimmedProduct = product.trim();
    const parsedDate = new Date(date).toISOString().split('T')[0];

    const { sql } = await import('../../database/pgDb.js');

    // Start transaction
    await sql.begin(`BEGIN;`);

    try {
      // 1. Validate stock availability for all items
      for (const item of items) {
        if (!item.vendor_id || !item.item_id || item.quantity <= 0) continue;

        const stockRow = await sql`
          SELECT actual, expected FROM vendor_items WHERE id = ${item.item_id}
        `;

        const availableQty = stockRow.length > 0 ? stockRow[0].actual : 0;
        const requestedQty = parseInt(item.quantity, 10);
        const itemName = stockRow.length > 0 ? stockRow[0].name : 'unknown item';

        if (availableQty < requestedQty) {
          await sql`ROLLBACK`;
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Insufficient stock for "${itemName}". Available: ${availableQty}, Requested: ${requestedQty}` 
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // 2. Insert Delivery
      const deliveryId = crypto.randomUUID();
      await sql`
        INSERT INTO deliveries (id, date, location, rider, product_details, price_cents, fee_cents, created_at, updated_at)
        VALUES (${deliveryId}, ${parsedDate}, ${trimmedLocation}, ${trimmedRider}, ${trimmedProduct}, ${parsedPrice}, ${parsedFee}, NOW(), NOW())
      `;

      // 3. Deduct from BOTH actual and expected, and record Delivery Items snapshot
      for (const item of items) {
        if (!item.vendor_id || !item.item_id || item.quantity <= 0) continue;

        const qty = parseInt(item.quantity, 10);

        await sql`
          UPDATE vendor_items
          SET actual = actual - ${qty}, expected = expected - ${qty}, updated_at = NOW(), sync_event_id = gen_random_uuid()
          WHERE id = ${item.item_id}
        `;

        // Insert delivery item snapshot
        const snapshotId = crypto.randomUUID();
        await sql`
          INSERT INTO delivery_items (id, delivery_id, vendor_id, item_id, vendor_name_snapshot, item_name_snapshot, unit_price_cents, quantity, created_at, updated_at, sync_event_id)
          VALUES (${snapshotId}, ${deliveryId}, ${item.vendor_id}, ${item.item_id}, 
                  'dummy_vendor', 'dummy_item', ${parsedPrice}, ${qty}, NOW(), NOW(), gen_random_uuid())
        `;
      }

      // 4. Record sync event for real-time sync
      const syncEventId = crypto.randomUUID();
      await sql`
        INSERT INTO sync_events (id, entity_type, entity_id, action, payload, source, created_at, processed)
        VALUES (${syncEventId}, 'delivery', ${deliveryId}, 'create', 
                ${{ deliveryId, date: parsedDate, location: trimmedLocation, rider: trimmedRider }}, 'web', NOW(), FALSE)
      `;

      await sql`COMMIT`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          deliveryId,
          message: 'Delivery created and stock deducted' 
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error('POST /api/deliveries error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/deliveries/:id - Delete delivery
 * Restores both actual and expected stock back to vendor items
 * Query: ?confirm=true
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const deliveryId = searchParams.get('id');
    const confirm = searchParams.get('confirm');

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Delivery ID required' }),
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

    // Start transaction
    await sql.begin(`BEGIN;`);

    try {
      // 1. Fetch old items for this delivery
      const oldItems = await sql`
        SELECT item_id, quantity FROM delivery_items WHERE delivery_id = ${deliveryId}
      `;

      // 2. Restore stock for each item to actual & expected
      for (const item of oldItems) {
        if (item.item_id) {
          await sql`
            UPDATE vendor_items
            SET actual = actual + ${item.quantity}, expected = expected + ${item.quantity}, updated_at = NOW()
            WHERE id = ${item.item_id}
          `;
        }
      }

      // 3. Delete delivery items and delivery
      await sql`DELETE FROM delivery_items WHERE delivery_id = ${deliveryId}`;
      await sql`DELETE FROM deliveries WHERE id = ${deliveryId}`;

      // 4. Record sync event
      await sql`
        INSERT INTO sync_events (id, entity_type, entity_id, action, payload, source, created_at, processed)
        VALUES (${crypto.randomUUID()}, 'delivery', ${deliveryId}, 'delete',
                ${{ deliveryId }}, 'web', NOW(), FALSE)
      `;

      await sql`COMMIT`;

      return new Response(
        JSON.stringify({ success: true, message: 'Delivery deleted and stock restored' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error('DELETE /api/deliveries error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}