/**
 * Sync API Route for Vercel Serverless Functions
 * 
 * Handles real-time sync between Android app and Web UI
 * Tracks changes via sync_events table for conflict resolution
 * 
 * GET /api/sync?since=timestamp - Get changes since timestamp
 * POST /api/sync/process - Mark sync events as processed
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
 * GET /api/sync?since=timestamp - Get changes since timestamp
 * Used by both Android app and web UI to fetch new changes
 * Query param: since (ISO timestamp string)
 * Returns: { created, updated, deleted } arrays of changes
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    const { sql } = await import('../../database/pgDb.js');

    let whereClause = '';
    let params = [];

    if (since) {
      whereClause = `WHERE created_at > ${since}`;
      params.push(since);
    }

    // Get created (new) changes
    const created = await sql`
      SELECT id, entity_type, entity_id, action, payload, source, created_at
      FROM sync_events
      WHERE processed = FALSE ${sql.join(whereClause, ' ')}
      ORDER BY created_at ASC
    `;

    // Get processed changes that need to be applied but marked processed
    // Actually, we want UNPROCESSED changes
    const unprocessedWhere = whereClause ? `AND processed = FALSE` : `WHERE processed = FALSE`;
    const unprocessed = await sql`
      SELECT id, entity_type, entity_id, action, payload, source, created_at
      FROM sync_events
      ${unprocessedWhere}
      ORDER BY created_at ASC
    `;

    // Transform for client consumption
    const transformChanges = (changes) => changes.map((c) => ({
      id: c.id,
      entityType: c.entity_type,
      entityId: c.entity_id,
      action: c.action,
      payload: c.payload,
      source: c.source,
      createdAt: c.created_at,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: transformChanges(created),
        since: since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // default last 24h
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET /api/sync error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/sync/process - Mark sync events as processed
 * Body: { eventIds: ['id1', 'id2'] }
 * Marks events as processed so they won't be sent again
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { eventIds } = body;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'eventIds array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sql } = await import('../../database/pgDb.js');
    const now = new Date().toISOString();

    // Mark events as processed
    await sql`
      UPDATE sync_events
      SET processed = TRUE, processed_at = ${now}
      WHERE id = ANY(${eventIds})
    `;

    return new Response(
      JSON.stringify({ success: true, processed: eventIds.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/sync/process error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/sync/events - Submit new sync events from client
 * Used by Android app to push local deductions to web
 * Body: { events: [...] }
 */
export async function POST_events(req) {
  try {
    const body = await req.json();
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'events array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { sql } = await import('../../database/pgDb.js');
    const now = new Date().toISOString();

    for (const event of events) {
      await sql`
        INSERT INTO sync_events (id, entity_type, entity_id, action, payload, source, created_at, processed)
        VALUES (${crypto.randomUUID()}, ${event.entityType}, ${event.entityId}, ${event.action},
                ${JSON.stringify(event.payload)}, ${event.source || 'android_app'}, ${now}, FALSE)
      `;
    }

    return new Response(
      JSON.stringify({ success: true, submitted: events.length }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/sync/events error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}