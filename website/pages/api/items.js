import { NextResponse } from 'next/server';

export const GET = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');

    // Mock data - in real app, query PostgreSQL
    let items = [];
    if (vendorId) {
      items = [{ id: '1', vendor_id: vendorId, name: 'Sample Item', price: 100, expected: 50, actual: 45 }];
    }

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('GET /api/items error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const POST = async (req) => {
  try {
    const body = await req.json();
    const { vendorId, name, price, expected, actual } = body;

    if (!vendorId || !name || name.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Vendor ID and item name are required' },
        { status: 400 }
      );
    }

    // In real app, insert into PostgreSQL
    const newItem = { 
      id: Date.now().toString(), 
      vendor_id: vendorId, 
      name: name.trim(), 
      price, 
      expected, 
      actual 
    };

    return NextResponse.json(
      { success: true, item: newItem },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/items error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const PATCH = async (req) => {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');
    const { expected, actual, price } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, message: 'Item ID required' },
        { status: 400 }
      );
    }

    // In real app, update PostgreSQL
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('PATCH /api/items error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const DELETE = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { success: false, message: 'Item ID required' },
        { status: 400 }
      );
    }

    // In real app, delete from PostgreSQL
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/items error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};