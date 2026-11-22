import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportExcelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleImport = async (file) => {
    setLoading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Import successful' });
        // Refresh the data
        router.refresh();
      } else {
        setStatus({ type: 'error', message: data.message || 'Import failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f0f2f5',
      padding: 20
    }}>
      <h1>Import Excel Stock</h1>
      
      <div style={{ 
        background: 'white', 
        padding: 24, 
        borderRadius: 8, 
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        maxWidth: 600,
        margin: '0 auto'
      }}>
        <h2>Upload Excel File</h2>
        
        {status && (
          <div style={{ 
            padding: 12, 
            borderRadius: 4, 
            marginBottom: 16,
            ...(status.type === 'success' ? { background: '#d4edda', color: '#155724' } : { background: '#f8d7da', color: '#721c24' })
          }}>
            {status.message}
          </div>
        )}
        
        <p style={{ color: '#666', marginBottom: 16 }}>
          Format: Vendor | Item | Quantity | Price (NGN)
        </p>
        
        <input 
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => handleImport(e.target.files[0])}
          style={{
            width: '100%', 
            padding: 12, 
            border: '1px solid #ddd', 
            borderRadius: 4, 
            marginBottom: 16,
            fontSize: 14
          }}
          disabled={loading}
        />
        
        {loading && (
          <p style={{ textAlign: 'center', color: '#666' }}>Processing...</p>
        )}
      </div>
    </div>
  );
}