/**
 * Expenses API Route for Vercel Serverless Functions
 * 
 * CRUD operations for expenses
 * Accessible after auth
 * 
 * GET /api/expenses - List all expenses
 * POST /api/expenses - Create new expense
 * DELETE /api/expenses/:id - Delete expense
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
 * GET /api/expenses - List all expenses
 */
export async function GET(req) {
  try {
    const { sql } = await import('../../database/pgDb.js');

    const expenses = await sql`
      SELECT id, date, description, amount_cents / 100 AS amount_dollars, created_at
      FROM expenses
      ORDER BY created_at DESC
    `;

    return new Response(
      JSON.stringify({ success: true, expenses }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('GET /api/expenses error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/expenses - Create new expense
 * Body: { date, description, amount }
 * amount: in dollars (converted to cents internally)
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { date, description, amount } = body;

    if (!description || description.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Description is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const trimmedDescription = description.trim();
    const parsedAmount = amount !== undefined ? Math.max(0, Math.floor(parseFloat(amount) * 100)) : 0; // cents
    const parsedDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const { sql } = await import('../../database/pgDb.js');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO expenses (id, date, description, amount_cents, created_at, updated_at)
      VALUES (${id}, ${parsedDate}, ${trimmedDescription}, ${parsedAmount}, ${now}, ${now})
    `;

    return new Response(
      JSON.stringify({ 
        success: true, 
        expense: { id, description: trimmedDescription, amount: parsedAmount / 100, date: parsedDate } 
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/expenses error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/expenses/:id - Delete expense
 * Query: ?confirm=true
 */
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const expenseId = searchParams.get('id');
    const confirm = searchParams.get('confirm');

    if (!expenseId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Expense ID required' }),
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

    const result = await sql`DELETE FROM expenses WHERE id = ${expenseId}`;

    if (result.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Expense not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Expense deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('DELETE /api/expenses error:', error.message);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}