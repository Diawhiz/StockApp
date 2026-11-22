import { NextResponse } from 'next/server';

export const GET = async (req) => {
  try {
    // Mock data - in real app, query PostgreSQL
    const expenses = [
      { id: '1', date: '2024-01-15', description: 'Transport', amount: 5000 },
      { id: '2', date: '2024-01-16', description: 'Utilities', amount: 3000 },
    ];

    return NextResponse.json({ success: true, expenses });
  } catch (error) {
    console.error('GET /api/expenses error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const POST = async (req) => {
  try {
    const body = await req.json();
    const { date, description, amount } = body;

    if (!description || description.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Description is required' },
        { status: 400 }
      );
    }

    // In real app, insert into PostgreSQL
    const newExpense = { 
      id: Date.now().toString(), 
      date: date || new Date().toISOString().split('T')[0], 
      description: description.trim(), 
      amount: amount || 0 
    };

    return NextResponse.json(
      { success: true, expense: newExpense },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/expenses error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const DELETE = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const expenseId = searchParams.get('id');

    if (!expenseId) {
      return NextResponse.json(
        { success: false, message: 'Expense ID required' },
        { status: 400 }
      );
    }

    // In real app, delete from PostgreSQL
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/expenses error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};