import { NextResponse } from 'next/server';

// Simple auth middleware
async function withAuth(fn) {
  return async (req) => {
    const { searchParams } = new URL(req.url);
    const auth = searchParams.get('authorization') || '';
    
    // In a real app, this would check the token from cookies/headers
    // For simplicity, we'll check a basic header
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
    
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    // Basic token validation
    try {
      const decoded = atob(token);
      const parts = decoded.split(':');
      if (parts.length !== 3 || parts[0] !== 'admin') {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    return await fn(req);
  };
}

export const GET = withAuth(async (req) => {
  try {
    // In a real app, this would query the PostgreSQL database
    // For now, return mock data structure
    const vendors = [
      { id: '1', name: 'Example Vendor', items: [] },
    ];
    return NextResponse.json({ success: true, vendors });
  } catch (error) {
    console.error('GET /api/vendors error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Vendor name is required' },
        { status: 400 }
      );
    }

    // In a real app, insert into PostgreSQL
    const newVendor = { id: Date.now().toString(), name: name.trim(), items: [] };
    
    return NextResponse.json(
      { success: true, vendor: newVendor },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/vendors error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('id');

    if (!vendorId) {
      return NextResponse.json(
        { success: false, message: 'Vendor ID required' },
        { status: 400 }
      );
    }

    // In a real app, delete from PostgreSQL
    return NextResponse.json(
      { success: true, message: 'Vendor deleted successfully' }
    );
  } catch (error) {
    console.error('DELETE /api/vendors error:', error.message);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
});