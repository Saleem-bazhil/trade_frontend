import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud, FileSpreadsheet, Download, CheckCircle,
  AlertCircle, X, Plus, Layers, ArrowRight, Sun, Moon
} from 'lucide-react';

const API_BASE = '/api';

const Spinner = () => (
  <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
    <path d="M12 2v4" />
  </svg>
);

function App() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  /* ─── Drag & drop handlers ─── */
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles) => {
    setError(null);
    setResult(null);
    const valid = [];
    for (const f of newFiles) {
      if (!f.name.endsWith('.xlsx')) { setError(`"${f.name}" is not a valid .xlsx file.`); continue; }
      if (!files.some(ex => ex.name === f.name)) valid.push(f);
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx) => { setFiles(prev => prev.filter((_, i) => i !== idx)); setResult(null); };
  const triggerFileInput = () => fileInputRef.current?.click();

  /* ─── Process ─── */
  const processFiles = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);

    const formData = new FormData();
    const isSingle = files.length === 1;

    if (isSingle) {
      formData.append('file', files[0]);
    } else {
      for (const f of files) formData.append('files', f);
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
      const contentDisposition = response.headers.get('Content-Disposition');

      let fileStats = null;
      try { fileStats = fileStatsRaw ? JSON.parse(fileStatsRaw) : null; } catch {}

      let filename = `Trade_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
      if (contentDisposition?.includes('filename='))
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');

      const blob = await response.blob();
      setResult({
        downloadUrl: window.URL.createObjectURL(blob),
        filename,
        recordsProcessed: recordsProcessed || '0',
        recordsFiltered: recordsFiltered || '0',
        fileStats,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  /* ─── Render ─── */
  return (
    <>
      {/* Theme toggle */}
      <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div className="split-layout">

        {/* ─── LEFT: Upload Panel ─── */}
        <div className="split-left">
          <div className="split-left-inner">
            <header className="fade-up" style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                Trade Report Generator
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Upload Flex WIP Reports to generate a filtered Trade Report with Pivot Table.
              </p>
            </header>

            <div className="card fade-up" style={{ animationDelay: '0.1s' }}>
              <div style={{ padding: 24 }}>

                {/* Upload Zone */}
                <div
                  className={`drop-zone ${files.length > 0 || dragActive ? 'has-files' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  style={{ padding: '36px 20px', textAlign: 'center' }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept=".xlsx"
                    multiple
                    style={{ display: 'none' }}
                  />

                  {files.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <Layers size={36} style={{ color: 'var(--accent)', marginBottom: 4 }} />
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {files.length} file{files.length > 1 ? 's' : ''} selected
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={12} /> Click or drop to add more
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <UploadCloud size={36} style={{ color: 'var(--accent)', marginBottom: 4 }} />
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Drag & drop your files here
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        or click to browse &middot; .xlsx only &middot; multiple files
                      </span>
                    </div>
                  )}
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {files.map((f, i) => (
                      <div key={i} className="file-chip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <FileSpreadsheet size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                              {f.name}
                            </p>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {(f.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button className="file-chip-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="error-banner fade-up" style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>{error}</span>
                  </div>
                )}

                {/* Action Button */}
                <div style={{ marginTop: 20 }}>
                  <button
                    className="btn-primary"
                    onClick={processFiles}
                    disabled={files.length === 0 || processing}
                    style={{ width: '100%' }}
                  >
                    {processing ? (
                      <>
                        <Spinner />
                        <span style={{ marginLeft: 10 }}>Processing…</span>
                      </>
                    ) : (
                      <>
                        {files.length > 1
                          ? `Generate & Combine (${files.length} files)`
                          : 'Generate Trade Report'}
                        <ArrowRight size={17} style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            <p style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Flex WIP → Trade Report + Pivot Table
            </p>
          </div>
        </div>

        {/* ─── RIGHT: Output Panel ─── */}
        <div className="split-right">
          {!result && !processing && (
            <div className="empty-state fade-up">
              <FileSpreadsheet size={64} style={{ color: 'var(--border)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                No report yet
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 260 }}>
                Upload files and generate to see results here.
              </p>
            </div>
          )}

          {processing && (
            <div className="empty-state fade-up">
              <div style={{ marginBottom: 16 }}>
                <svg className="spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.2" />
                  <path d="M12 2v4" />
                </svg>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Processing…
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                This may take a moment for large files.
              </p>
            </div>
          )}

          {result && !processing && (
            <div className="fade-up" style={{ width: '100%', maxWidth: 500 }}>
              {/* Success header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div className="success-badge">
                  <CheckCircle size={22} color="#fff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {result.fileStats ? 'Reports Combined!' : 'Report Ready!'}
                </h3>
              </div>

              {/* Per-file breakdown */}
              {result.fileStats && (
                <div style={{ marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.fileStats.map((stat, i) => (
                    <div key={i} className="file-chip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <FileSpreadsheet size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {stat.filename}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.76rem', flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{stat.total} total</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{stat.filtered} trade</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div className="stat-card">
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Records Scanned
                  </span>
                  <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 4, color: 'var(--text-primary)' }}>
                    {Number(result.recordsProcessed).toLocaleString()}
                  </div>
                </div>
                <div className="stat-card accent">
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Trade Records
                  </span>
                  <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: 4, color: 'var(--accent)' }}>
                    {Number(result.recordsFiltered).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Download */}
              <a href={result.downloadUrl} download={result.filename} className="btn-download">
                <Download size={18} style={{ marginRight: 10 }} />
                Download {result.filename}
              </a>
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export default App;
