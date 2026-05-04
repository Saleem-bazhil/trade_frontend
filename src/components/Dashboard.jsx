import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  UploadCloud, FileSpreadsheet, Download,
  Sun, Moon, Search, Plus, Filter, ChevronDown, X, LogOut, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';

const Spinner = () => (
  <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
    <path d="M12 2v4" />
  </svg>
);

function Dashboard() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(() => {
    try {
      const savedResult = localStorage.getItem('tradeResult');
      return savedResult ? JSON.parse(savedResult) : null;
    } catch (e) {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState({}); // { 'Status': ['NEW', 'PENDING'] }
  const [openFilter, setOpenFilter] = useState(null); // 'Status'
  const [filterSearch, setFilterSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newWO, setNewWO] = useState({
    'Ticket No': '', 'Case Id': '', 'Product Name': '', 'Product Type': '',
    'Product Serial No': '', 'WIP Aging': '0', 'WIP Aging Category': '',
    'HP Owner': '', 'Status': 'NEW', 'Current Remarks': '', 'ASP City': ''
  });

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(Array.isArray(data) ? data : []);
      } else {
        console.error('History API returned:', response.status, response.statusText);
        setHistory([]);
      }
    } catch (err) {
      console.error('Failed to load file history:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('tradeResult', JSON.stringify(result));
    } else {
      localStorage.removeItem('tradeResult');
    }
  }, [result]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const handleFileChange = async (e) => {
    if (e.target.files?.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleRemarkChange = (idx, value) => {
    setResult(prev => {
      if (!prev) return prev;
      const newData = [...prev.gridData];
      const item = filteredData[idx];
      const originalIdx = prev.gridData.findIndex(r => r === item);
      if (originalIdx !== -1) {
        newData[originalIdx] = { ...newData[originalIdx], 'Current Remarks': value };
      }
      return { ...prev, gridData: newData };
    });
  };


  const getUniqueValues = (column) => {
    if (!result?.gridData) return [];
    const values = [...new Set(result.gridData.map(row => String(row[column] || '')))];
    return values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  };

  const toggleColumnFilter = (column, value) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      
      const newFilters = { ...prev };
      if (next.length === 0) delete newFilters[column];
      else newFilters[column] = next;
      return newFilters;
    });
  };

  const clearColumnFilter = (column) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[column];
      return newFilters;
    });
  };

  const applyAllToColumn = (column, values) => {
    setColumnFilters(prev => ({ ...prev, [column]: values }));
  };

  const filteredData = useMemo(() => {
    if (!result?.gridData) return [];
    
    return result.gridData.filter(row => {
      // 1. Global Search
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || Object.values(row).some(val => 
        String(val || '').toLowerCase().includes(q)
      );
      
      if (!matchesSearch) return false;

      // 2. Column Filters
      const matchesColumnFilters = Object.entries(columnFilters).every(([col, selectedValues]) => {
        if (!selectedValues || selectedValues.length === 0) return true;
        return selectedValues.includes(String(row[col] || ''));
      });

      return matchesColumnFilters;
    });
  }, [result?.gridData, search, columnFilters]);

  // Click outside to close filter popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openFilter && !e.target.closest('.filter-popover') && !e.target.closest('.filter-trigger')) {
        setOpenFilter(null);
        setFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFilter]);

  const FilterPopover = ({ column }) => {
    const uniqueValues = getUniqueValues(column);
    const selected = columnFilters[column] || [];
    const filteredUniqueValues = uniqueValues.filter(v => 
      v.toLowerCase().includes(filterSearch.toLowerCase())
    );

    return (
      <div className="filter-popover">
        <div className="filter-popover-header">
          <input 
            type="text" 
            className="filter-search" 
            placeholder={`Search ${column}...`}
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            autoFocus
          />
          <div className="filter-actions">
            <button onClick={() => applyAllToColumn(column, uniqueValues)}>Select All</button>
            <button onClick={() => clearColumnFilter(column)}>Clear</button>
          </div>
        </div>
        <div className="filter-list">
          {filteredUniqueValues.map(val => (
            <label key={val} className="filter-item">
              <input 
                type="checkbox" 
                checked={selected.includes(val)}
                onChange={() => toggleColumnFilter(column, val)}
              />
              <span className="truncate" title={val}>{val || '(Blanks)'}</span>
            </label>
          ))}
          {filteredUniqueValues.length === 0 && <div style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No matches</div>}
        </div>
        <div className="filter-footer">
          <button className="btn-filter-apply" onClick={() => setOpenFilter(null)}>Done</button>
        </div>
      </div>
    );
  };

  const RenderHeader = ({ label, column, width }) => {
    const isFiltered = columnFilters[column] && columnFilters[column].length > 0;
    const isOpen = openFilter === column;

    return (
      <th style={{ width, position: 'relative', fontSize: '0.8rem' }}>
        <div className="header-content">
          <span>{label}</span>
          {column && (
            <div 
              className={`filter-trigger ${isFiltered ? 'active' : ''}`}
              onClick={() => {
                setOpenFilter(isOpen ? null : column);
                setFilterSearch('');
              }}
            >
              <Filter size={12} fill={isFiltered ? 'currentColor' : 'none'} />
            </div>
          )}
        </div>
        {isOpen && <FilterPopover column={column} />}
      </th>
    );
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

  const handleExport = () => {
    if (!result?.gridData) return;
    const ws = XLSX.utils.json_to_sheet(result.gridData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trade Report");
    XLSX.writeFile(wb, result.filename || `Trade_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
  };

  const handleAddWO = (e) => {
    e.preventDefault();
    if (!newWO['Ticket No'] || !newWO['Case Id']) {
      alert("Ticket No and Case Id are required!");
      return;
    }

    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        gridData: [newWO, ...prev.gridData],
        recordsFiltered: String(Number(prev.recordsFiltered) + 1),
        recordsProcessed: String(Number(prev.recordsProcessed) + 1)
      };
    });

    setIsAddModalOpen(false);
    setNewWO({
      'Ticket No': '', 'Case Id': '', 'Product Name': '', 'Product Type': '',
      'Product Serial No': '', 'WIP Aging': '0', 'WIP Aging Category': '',
      'HP Owner': '', 'Status': 'NEW', 'Current Remarks': '', 'ASP City': ''
    });
  };


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
               <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginRight: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total Flex Calls</span>
                     <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 900 }}>{Number(result.recordsProcessed).toLocaleString()}</span>
                  </div>
                  <div style={{ height: 32, width: 1, background: 'var(--border-subtle)' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <span style={{ fontSize: '0.75rem', color: 'var(--brand-accent)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total Trade Calls</span>
                     <span style={{ fontSize: '1.05rem', color: 'var(--brand-accent)', fontWeight: 900 }}>{Number(result.recordsFiltered).toLocaleString()}</span>
                  </div>
               </div>
               
               {result.cityStats && Object.entries(result.cityStats).length > 0 && (
                 <div className="city-stats-container">
                    {Object.entries(result.cityStats).map(([city, count]) => (
                      <div key={city} className="city-pill" title={`${city}: ${count} trades`}>
                        <span className="city-name">{city}</span>
                        <span className="city-count">{count}</span>
                      </div>
                    ))}
                 </div>
               )}

               <button onClick={handleExport} className="btn-export" title="Download Trade Report (Direct Download)">
                 <Download size={15} style={{ marginRight: 8 }}/>
                 <span>Export Trade Report</span>
               </button>
            </>
          )}
          
          <button className="theme-toggle-icon" onClick={() => { setIsHistoryModalOpen(true); fetchHistory(); }} title="File Import & Export History">
            <Clock size={18} />
          </button>

          <button className="theme-toggle-icon" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button className="theme-toggle-icon" onClick={handleLogout} title="Logout" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <LogOut size={18} />
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
                <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
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
                    <th style={{ 
                      width: 60, 
                      position: 'sticky', 
                      left: 0, 
                      zIndex: 3, 
                      background: 'var(--surface-table)',
                      borderRight: '1px solid var(--border-strong)'
                    }}>SN</th>
                    <RenderHeader label="Ticket No" column="Ticket No" width={130} />
                    <RenderHeader label="Case Id" column="Case Id" width={120} />
                    <RenderHeader label="Product Name" column="Product Name" width={250} />
                    <RenderHeader label="Product Type" column="Product Type" width={130} />
                    <RenderHeader label="Product Serial No" width={140} />
                    <RenderHeader label="WIP Aging" column="WIP Aging" width={100} />
                    <RenderHeader label="WIP Aging Category" column="WIP Aging Category" width={160} />
                    <RenderHeader label="HP Owner" column="HP Owner" width={120} />
                    <RenderHeader label="Status" column="Status" width={130} />
                    <RenderHeader label="Current Remarks" column="Current Remarks" width={220} />
                    <RenderHeader label="ASP City" column="ASP City" width={140} />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => {
                    const status = String(row['Status'] || '-');
                    const rowClass = getStatusClass(status);
                    const wipStr = row['WIP Aging'] || '-';
                    
                    return (
                      <tr key={idx} className={rowClass}>
                        <td style={{ 
                          textAlign: 'center', 
                          color: 'var(--text-muted)', 
                          fontWeight: 600, 
                          fontSize: '0.8rem',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: 'var(--surface-table)',
                          borderRight: '1px solid var(--border-subtle)'
                        }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {row['Ticket No'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {row['Case Id'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-primary)' }} className="truncate-cell" title={row['Product Name'] || ''}>
                          {row['Product Name'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                           {row['Product Type'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                           {row['Product Serial No'] || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={getWipBadgeClass(wipStr)}>{wipStr}</span>
                        </td>
                        <td style={{ color: 'var(--purple-text)', fontWeight: 600, fontSize: '0.85rem' }}>
                          {row['WIP Aging Category'] || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {row['HP Owner'] || '-'}
                        </td>
                        <td className="status-cell">
                           <span>{status}</span>
                        </td>
                        <td className="truncate-cell" style={{ color: 'var(--text-secondary)', padding: '4px' }}>
                          <textarea 
                            className="remarks-textarea"
                            value={row['Current Remarks'] || ''}
                            onChange={(e) => handleRemarkChange(idx, e.target.value)}
                            placeholder="Type remarks here..."
                          />
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
      {/* ─── ADD WO MODAL ─── */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Work Order</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWO}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Ticket No *</label>
                    <input 
                      required
                      type="text" 
                      value={newWO['Ticket No']} 
                      onChange={e => setNewWO({...newWO, 'Ticket No': e.target.value})} 
                      placeholder="e.g. 5012345678"
                    />
                  </div>
                  <div className="form-group">
                    <label>Case Id *</label>
                    <input 
                      required
                      type="text" 
                      value={newWO['Case Id']} 
                      onChange={e => setNewWO({...newWO, 'Case Id': e.target.value})} 
                      placeholder="e.g. 123456789"
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input 
                      type="text" 
                      value={newWO['Product Name']} 
                      onChange={e => setNewWO({...newWO, 'Product Name': e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Type</label>
                    <input 
                      type="text" 
                      value={newWO['Product Type']} 
                      onChange={e => setNewWO({...newWO, 'Product Type': e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={newWO['Status']} onChange={e => setNewWO({...newWO, 'Status': e.target.value})}>
                      <option value="NEW">NEW</option>
                      <option value="WIP">WIP</option>
                      <option value="PENDING">PENDING</option>
                      <option value="TRANSIT">TRANSIT</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ASP City</label>
                    <input 
                      type="text" 
                      value={newWO['ASP City']} 
                      onChange={e => setNewWO({...newWO, 'ASP City': e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>WIP Aging (Days)</label>
                    <input 
                      type="number" 
                      value={newWO['WIP Aging']} 
                      onChange={e => setNewWO({...newWO, 'WIP Aging': e.target.value})} 
                    />
                  </div>
                  <div className="form-group">
                    <label>HP Owner</label>
                    <input 
                      type="text" 
                      value={newWO['HP Owner']} 
                      onChange={e => setNewWO({...newWO, 'HP Owner': e.target.value})} 
                    />
                  </div>
                </div>
                <div className="form-group full">
                  <label>Current Remarks</label>
                  <textarea 
                    value={newWO['Current Remarks']} 
                    onChange={e => setNewWO({...newWO, 'Current Remarks': e.target.value})} 
                    placeholder="Enter latest updates..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Work Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── FILE HISTORY MODAL ─── */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>File History</h2>
              <button className="modal-close" onClick={() => setIsHistoryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {loadingHistory ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                  <Spinner />
                  <span style={{ marginLeft: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Loading history...</span>
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No file history recorded yet.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Filename</th>
                        <th>Action</th>
                        <th>Processed</th>
                        <th>Filtered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="truncate-cell" title={h.filename}>
                            {h.filename || '-'}
                          </td>
                          <td>
                            <span className={`wip-badge ${h.action === 'Export' ? 'warning' : 'default'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                              {h.action || 'Unknown'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {h.total_records || 0}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--brand-accent)', fontWeight: 700 }}>
                            {h.filtered_records || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
