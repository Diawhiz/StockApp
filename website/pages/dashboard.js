import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendors?vendorId=')
      .then(res => res.json())
      .then(data => {
        setVendors(data.vendors || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Sage Logistics Dashboard</h2>
        <p>Loading vendors...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f0f2f5',
      padding: 20
    }}>
      <h1>Sage Logistics - Dashboard</h1>
      
      <div style={{ 
        background: 'white', 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2>Inventory Overview</h2>
        
        {vendors.length === 0 ? (
          <p>No vendors found. <a href="/add-vendor">Add your first vendor</a>.</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16
          }}>
            {vendors.map((vendor) => (
              <div 
                key={vendor.id}
                style={{
                  background: '#f8f9fa',
                  borderRadius: 8,
                  padding: 16,
                  border: '1px solid #e0e0e0'
                }}
              >
                <h3>{vendor.name}</h3>
                <p>Items: {vendor.items?.length || 0}</p>
                <p>Stock Value: {vendor.items?.reduce((sum, it) => sum + (it.price || 0) * (it.actual || 0), 0) || 0} NGN</p>
                <button 
                  onClick={() => router.push(`/vendor/${vendor.id}`)}
                  style={{
                    width: '100%', 
                    marginTop: 8, 
                    padding: 8, 
                    background: '#0057b8', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 4,
                    textAlign: 'left'
                  }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div style={{ 
        background: 'white', 
        padding: 20, 
        borderRadius: 8, 
        marginTop: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h2>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <a 
            href="/add-vendor"
            style={{
              padding: 12, 
              background: '#0057b8', 
              color: 'white', 
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Add Vendor
          </a>
          <a 
            href="/import-excel"
            style={{
              padding: 12, 
              background: '#28a745', 
              color: 'white', 
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Import Excel
          </a>
        </div>
      </div>
    </div>
  );
}