import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // Fetch vendor data from API
    fetch(`/api/vendors?vendorId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.vendors && data.vendors.length > 0) {
          setVendor(data.vendors[0]);
          setItems(data.vendors[0].items || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Loading vendor...</h2>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Vendor not found</h2>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ padding: 10, background: '#0057b8', color: 'white', border: 'none', borderRadius: 4 }}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f0f2f5',
      padding: 20
    }}>
      <h1>Vendor: {vendor.name}</h1>
      
      <div style={{ 
        background: 'white', 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p>Total Items: {items.length}</p>
          <p>
            Expected: {items.reduce((sum, it) => sum + (it.expected || 0), 0)}
            &nbsp;|&nbsp; 
            Actual: {items.reduce((sum, it) => sum + (it.actual || 0), 0)}
          </p>
          <p>
            Missing: {items.reduce((sum, it) => sum + Math.max(0, (it.expected || 0) - (it.actual || 0)), 0)}
          </p>
        </div>
        
        <div style={{ 
          marginTop: 16, 
          maxHeight: 400, 
          overflowY: 'auto'
        }}>
          <h3>Products</h3>
          
          {items.length === 0 ? (
            <p>No products recorded for this vendor.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Item</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Expected</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Actual</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>Missing</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Price (NGN)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: 8 }}>{it.name}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{it.expected}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{it.actual}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      {it.expected > it.actual ? it.expected - it.actual : 0}
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      {it.price || 0} NGN
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      <div style={{ 
        background: 'white', 
        padding: 20, 
        borderRadius: 8, 
        marginTop: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3>Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <a 
            href={`/edit-vendor/${id}`}
            style={{
              padding: 12, 
              background: '#0057b8', 
              color: 'white', 
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Edit Vendor
          </a>
          <a 
            href={`/import-to-vendor/${id}`}
            style={{
              padding: 12, 
              background: '#28a745', 
              color: 'white', 
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: '600'
            }}
          >
            Import to Vendor
          </a>
        </div>
      </div>
    </div>
  );
}