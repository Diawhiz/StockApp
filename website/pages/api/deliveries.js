import { NextResponse } from 'next/server';

export const GET = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    // Mock data - in real app, query PostgreSQL
    const deliveries = date 
      ? [{ id: '1', date, location: 'Lagos', rider: 'John', product_details: 'Items', price_cents: 5000, fee_cents: 500 }]
      : [];

    return NextResponse.json({ success: true, deliveries });
  } catch (error) {
    console.error('GET /api/deliveries error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const POST = async (req) => {
  try {
    const body = await req.json();
    const { date, location, rider, product, price, fee, items } = body;

    // Validation
    if (!location || !rider || !product) {
      return NextResponse.json(
        { success: false, message: 'Location, rider, and product are required' },
        { status: 400 }
      );
    }

    // In real app, create delivery in PostgreSQL with stock deduction
    const newDelivery = { 
      id: Date.now().toString(), 
      date, 
      location, 
      rider, 
      product_details: product,
      price_cents: price ? Math.floor(price * 100) : 0,
      fee_cents: fee ? Math.floor(fee * 100) : 0 
    };

    return NextResponse.json(
      { success: true, delivery: newDelivery },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/deliveries error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const DELETE = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const deliveryId = searchParams.get('id');

    if (!deliveryId) {
      return NextResponse.json(
        { success: false, message: 'Delivery ID required' },
        { status: 400 }
      );
    }

    // In real app, delete delivery and restore stock from PostgreSQL
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/deliveries error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};