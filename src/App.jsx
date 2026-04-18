import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud, FileSpreadsheet, Download,
  Sun, Moon, Search, Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = '/api';

const Spinner = () => (
  <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
    <path d="M12 2v4" />
  </svg>
);

function App() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [search, setSearch] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const handleFileChange = async (e) => {
    if (e.target.files?.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const processFiles = async (selectedFiles) => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    const isSingle = selectedFiles.length === 1;

    if (isSingle) {
      formData.append('file', selectedFiles[0]);
    } else {
      for (const f of selectedFiles) formData.append('files', f);
    }

    const endpoint = isSingle
      ? `${API_BASE}/process-report`
      : `${API_BASE}/process-multiple`;

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      if (!response.ok) {
        let message = `Server error (${response.status})`;
        try {
          const err = await response.json();
          message = err.detail || message;
        } catch {}
        throw new Error(message);
      }

      const recordsProcessed = response.headers.get('X-Records-Processed');
      const recordsFiltered = response.headers.get('X-Records-Filtered');
      const fileStatsRaw = response.headers.get('X-File-Stats');
      const cityStatsRaw = response.headers.get('X-City-Stats');
      const contentDisposition = response.headers.get('Content-Disposition');

      let fileStats = null;
      try { fileStats = fileStatsRaw ? JSON.parse(fileStatsRaw) : null; } catch {}

      let cityStats = null;
      try { cityStats = cityStatsRaw ? JSON.parse(cityStatsRaw) : null; } catch {}

      let filename = `Trade_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
      if (contentDisposition?.includes('filename='))
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const tradeReportSheet = workbook.Sheets['Trade Report'];
      
      let gridData = [];
      if (tradeReportSheet) {
        gridData = XLSX.utils.sheet_to_json(tradeReportSheet, { defval: "" });
      }

      setResult({
        downloadUrl: window.URL.createObjectURL(blob),
        filename,
        recordsProcessed: recordsProcessed || '0',
        recordsFiltered: recordsFiltered || '0',
        fileStats,
        cityStats,
        gridData
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Filter logic
  const filteredData = useMemo(() => {
    if (!result?.gridData) return [];
    if (!search.trim()) return result.gridData;
    const q = search.toLowerCase();
    return result.gridData.filter(row => {
      const tNo = String(row['Ticket No'] || '').toLowerCase();
      const cId = String(row['Case Id'] || '').toLowerCase();
      const st = String(row['Status'] || '').toLowerCase();
      const loc = String(row['ASP City'] || '').toLowerCase();
      const prod = String(row['Product Name'] || '').toLowerCase();
      return tNo.includes(q) || cId.includes(q) || st.includes(q) || loc.includes(q) || prod.includes(q);
    });
  }, [result?.gridData, search]);

  const getStatusClass = (statusStr) => {
    const s = String(statusStr || '').toUpperCase();
    if (s.includes('NEW')) return 'status-new';
    if (s.includes('PENDING') || s.includes('WIP')) return 'status-pending';
    if (s.includes('CLOSED') || s.includes('RESOLVED')) return 'status-closed';
    return 'status-default';
  };

  const getWipBadgeClass = (wipStr) => {
    const w = parseInt(wipStr, 10);
    if (isNaN(w)) return 'wip-badge default';
    if (w > 10) return 'wip-badge danger';
    if (w > 5)  return 'wip-badge warning';
    return 'wip-badge default';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-app)' }}>
      {/* ─── TOP HEADER TOOLBAR ─── */}
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 24px', 
        background: 'var(--surface-header)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 10
      }}>
        {/* Left branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
             <FileSpreadsheet size={22} style={{ color: 'var(--brand-accent)' }}/>
             <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.02em' }}>Trade Report Explorer</h1>
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={processing}
            className="btn-upload"
          >
            {processing ? <Spinner /> : <UploadCloud size={16} />}
            <span style={{ marginLeft: 8, fontWeight: 600 }}>{processing ? 'Processing...' : 'Upload Flex Excel'}</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept=".xlsx"
            multiple
            style={{ display: 'none' }}
          />

          {error && <span style={{ color: 'var(--error-text)', fontSize: '0.85rem', fontWeight: 500 }}>{error}</span>}
        </div>

        {/* Right tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {result && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 8 }}>
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Total Scanned</span>
                     <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800 }}>{Number(result.recordsProcessed).toLocaleString()}</span>
                 </div>
                 <div style={{ height: 24, width: 1, background: 'var(--border-subtle)' }}></div>
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <span style={{ fontSize: '0.65rem', color: 'var(--brand-accent)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Trade Extracted</span>
                     <span style={{ fontSize: '0.95rem', color: 'var(--brand-accent)', fontWeight: 800 }}>{Number(result.recordsFiltered).toLocaleString()}</span>
                 </div>
              </div>
              <a href={result.downloadUrl} download={result.filename} className="btn-export">
                <Download size={15} style={{ marginRight: 8 }}/>
                <span>Export Report</span>
              </a>
            </>
          )}
          
          <button className="theme-toggle-icon" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px', overflow: 'hidden', position: 'relative' }}>
        
        {processing && (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', opacity: 0.85, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <svg className="spin" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.2" />
                  <path d="M12 2v4" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>Crunching Excel Data...</span>
             </div>
          </div>
        )}

        {!result && !processing && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileSpreadsheet size={64} style={{ opacity: 0.15, margin: '0 auto 20px' }} />
                <h3 style={{ fontSize: '1.3rem', margin: '0 0 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>No Data Available</h3>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>Use the 'Upload Flex Excel' button above to generate the trade lists.</p>
             </div>
          </div>
        )}

        {result && (
          <>
            {/* Table Header Area */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="search-bar">
                <Search size={16} strokeWidth={2.5} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search by Ticket, Case Id, Status, Area..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="btn-add">
                  <Plus size={16} /> Add WO
                </button>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                  {filteredData.length} OF {result.gridData.length} ROWS SHOWING
                </div>
              </div>
            </div>

            {/* Custom Designed Table */}
            <div className="table-container">
              <table className="custom-data-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Ticket No</th>
                    <th style={{ width: 120 }}>Case Id</th>
                    <th style={{ width: 180 }}>Current Remarks</th>
                    <th style={{ width: 100, textAlign: 'center' }}>WIP Aging</th>
                    <th style={{ width: 160 }}>WIP Aging Category</th>
                    <th style={{ width: 130 }}>Status</th>
                    <th style={{ width: 120 }}>HP Owner</th>
                    <th>Product Name</th>
                    <th style={{ width: 140 }}>Product Serial No</th>
                    <th style={{ width: 130 }}>Product Type</th>
                    <th style={{ width: 120 }}>ASP City</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const status = String(row['Status'] || '-');
                    const rowClass = getStatusClass(status);
                    const wipStr = row['WIP Aging'] || '-';
                    
                    return (
                      <tr key={idx} className={rowClass}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {row['Ticket No'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {row['Case Id'] || '-'}
                        </td>
                        <td className="truncate-cell" title={row['Current Remarks'] || ''} style={{ color: 'var(--text-secondary)' }}>
                          {row['Current Remarks'] || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={getWipBadgeClass(wipStr)}>{wipStr}</span>
                        </td>
                        <td style={{ color: 'var(--purple-text)', fontWeight: 600, fontSize: '0.85rem' }}>
                          {row['WIP Aging Category'] || '-'}
                        </td>
                        <td className="status-cell">
                           <span>{status}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {row['HP Owner'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-primary)' }} className="truncate-cell" title={row['Product Name'] || ''}>
                          {row['Product Name'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                           {row['Product Serial No'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                           {row['Product Type'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {row['ASP City'] || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                     <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '40px!', color: 'var(--text-muted)' }}>
                           No results match your search.
                        </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
