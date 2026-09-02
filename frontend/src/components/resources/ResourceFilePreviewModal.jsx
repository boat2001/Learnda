import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiBookmark, FiDownload, FiShare2, FiX } from 'react-icons/fi';
import api from '../../services/api';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { saveBlobAsFile, withDownloadLock } from '../../utils/downloadManager';
import SmartGate from '../subscription/SmartGate';
import './ResourceFilePreviewModal.css';

let pdfJsLoadPromise = null;

async function loadPdfJs() {
  if (!pdfJsLoadPromise) {
    pdfJsLoadPromise = (async () => {
      const [pdfjsMod, workerMod] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      pdfjsMod.GlobalWorkerOptions.workerSrc = workerMod.default;
      return pdfjsMod;
    })();
  }
  return pdfJsLoadPromise;
}

const MAX_PDF_PAGES = 40;
const PDF_SCALE = 1.15;
const RENDER_CONCURRENCY = 3;
const MAX_DPR = 2;

const isPdfBlob = (blob, fileName = '') => {
  const mime = (blob?.type || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  return /\.pdf$/i.test(String(fileName || ''));
};

const isImageBlob = (blob) => (blob?.type || '').toLowerCase().startsWith('image/');

export default function ResourceFilePreviewModal({ open, file, onClose, fetchBlob, onTrackView }) {
  const [status, setStatus] = useState('idle'); // loading | ready | error
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // pdf | image | other
  const [imageUrl, setImageUrl] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [showSmartGate, setShowSmartGate] = useState(false);
  const pdfDocRef = useRef(null);
  const pagesWrapRef = useRef(null);
  const imageObjectUrlRef = useRef('');
  const previewBlobRef = useRef(null);

  const revokeImageUrl = useCallback(() => {
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = '';
    }
    setImageUrl('');
  }, []);

  const destroyPdf = useCallback(() => {
    if (pdfDocRef.current) {
      try {
        pdfDocRef.current.destroy();
      } catch {
        /* ignore */
      }
      pdfDocRef.current = null;
    }
    if (pagesWrapRef.current) {
      pagesWrapRef.current.innerHTML = '';
    }
  }, []);

  const resetAll = useCallback(() => {
    revokeImageUrl();
    destroyPdf();
    previewBlobRef.current = null;
    setMode(null);
    setStatus('idle');
    setError('');
    setActionBusy('');
    setActionStatus('');
  }, [destroyPdf, revokeImageUrl]);

  useEffect(() => {
    if (!open || !file || (!file.sourceFileId && !fetchBlob)) return undefined;

    let cancelled = false;
    resetAll();

    const load = async () => {
      setStatus('loading');
      setError('');

      try {
        // Fire tracking without blocking — it's not on the critical path
        if (onTrackView) onTrackView().catch(() => {});
        else if (file.sourceFileId) api.resources.trackView(file.sourceFileId).catch(() => {});

        // Start loading pdfjs in parallel with the blob download
        const pdfJsPromise = loadPdfJs();

        const blob = fetchBlob
          ? await fetchBlob()
          : await api.resources.downloadFile(file.sourceFileId);
        if (cancelled) return;
        previewBlobRef.current = blob;

        const name = file.fileName || file.title || '';

        if (isPdfBlob(blob, name)) {
          // arrayBuffer conversion + pdfjs module both run while we already have the blob
          const [pdfjsLib, data] = await Promise.all([pdfJsPromise, blob.arrayBuffer()]);
          if (cancelled) return;
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          if (cancelled) {
            try { pdf.destroy(); } catch { /* ignore */ }
            return;
          }
          pdfDocRef.current = pdf;
          setMode('pdf');
          setStatus('ready');
          return;
        }

        if (isImageBlob(blob)) {
          const url = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          imageObjectUrlRef.current = url;
          setImageUrl(url);
          setMode('image');
          setStatus('ready');
          return;
        }

        setMode('other');
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not open this file.');
          setStatus('error');
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [open, file?.sourceFileId, file?.id, file?.fileName, file?.title, resetAll, fetchBlob, onTrackView]);

  useEffect(() => {
    if (!open || mode !== 'pdf' || status !== 'ready' || !pagesWrapRef.current) return undefined;
    const wrap = pagesWrapRef.current;
    const pdf = pdfDocRef.current;
    if (!pdf) return undefined;

    wrap.innerHTML = '';
    const maxPages = Math.min(pdf.numPages || 0, MAX_PDF_PAGES);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    // Pre-create ordered placeholder slots so pages always appear in sequence
    // even when rendered in parallel
    const slots = Array.from({ length: maxPages }, () => {
      const div = document.createElement('div');
      div.className = 'resource-file-preview-page-slot';
      wrap.appendChild(div);
      return div;
    });

    let cancelled = false;

    const renderPage = async (idx) => {
      if (cancelled) return;
      const page = await pdf.getPage(idx + 1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: PDF_SCALE * dpr });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
      canvas.className = 'resource-file-preview-page-canvas';
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) slots[idx].replaceWith(canvas);
    };

    (async () => {
      try {
        for (let i = 0; i < maxPages && !cancelled; i += RENDER_CONCURRENCY) {
          await Promise.all(
            Array.from(
              { length: Math.min(RENDER_CONCURRENCY, maxPages - i) },
              (_, k) => renderPage(i + k),
            ),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Could not render PDF.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      wrap.innerHTML = '';
    };
  }, [open, mode, status]);

  useEffect(() => {
    if (!open) {
      resetAll();
    }
  }, [open, resetAll]);

  useEffect(() => {
    if (!open) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      releaseBodyScroll();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !file || (!file.sourceFileId && !fetchBlob)) return null;

  const title = file.title || file.fileName || 'File preview';
  const fileId = file.sourceFileId || file.source_file_id || file.id || file.contentId;
  const fileName = file.fileName || file.file_name || file.title || 'resource-file';
  const isShortContent = status === 'loading' || status === 'error' || (status === 'ready' && mode === 'other');

  const getPreviewBlob = async () => {
    if (previewBlobRef.current) return previewBlobRef.current;
    if (fetchBlob) {
      const blob = await fetchBlob();
      previewBlobRef.current = blob;
      return blob;
    }
    if (!fileId) throw new Error('This file cannot be downloaded right now.');
    const blob = await api.resources.downloadFile(fileId);
    previewBlobRef.current = blob;
    return blob;
  };

  const isDownloadLimitError = (err) => {
    const msg = String(err?.message || err?.error || '').toLowerCase();
    return msg.includes('limit') || msg.includes('quota') || (err?.status === 429);
  };

  const handleDownload = async () => {
    setActionStatus('');
    setActionBusy('download');
    setShowSmartGate(false);
    try {
      const result = await withDownloadLock(
        async () => {
          const blob = await getPreviewBlob();
          saveBlobAsFile(blob, fileName);
          if (fileId) api.resources.trackView(fileId).catch(() => {});
          setActionStatus('Download started.');
        },
        () => setActionStatus('Another download is already running.'),
      );
      if (result?.blocked) return;
    } catch (e) {
      if (isDownloadLimitError(e)) {
        setShowSmartGate(true);
      } else {
        setActionStatus(e?.message || 'Could not download this file.');
      }
    } finally {
      setActionBusy('');
    }
  };

  const handleShare = async () => {
    setActionStatus('');
    setActionBusy('share');
    const shareUrl = file.shareUrl || file.fileUrl || file.url || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `Check out ${title} on Sharether.`,
          url: shareUrl,
        });
        setActionStatus('Share sheet opened.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setActionStatus('Link copied.');
      } else {
        setActionStatus('Sharing is not available in this browser.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setActionStatus('Could not share this file.');
    } finally {
      setActionBusy('');
    }
  };

  const handleSaveToPls = async () => {
    if (!fileId) {
      setActionStatus('This file cannot be saved right now.');
      return;
    }

    setActionStatus('');
    setActionBusy('save');
    try {
      await api.pls.addToPLS(fileId, 'file');
      setActionStatus('Saved to PLS.');
    } catch (e) {
      if (e?.status === 401) {
        window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
        setActionStatus('Log in to save this file.');
      } else {
        setActionStatus(e?.message || 'Could not save this file.');
      }
    } finally {
      setActionBusy('');
    }
  };

  return createPortal(
    <div className="resource-file-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className="resource-file-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-file-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="resource-file-preview-header">
          <h2 id="resource-file-preview-title" className="resource-file-preview-title">
            {title}
          </h2>
          <div className="resource-file-preview-header-right">
            <img
              src="/sharether-logo.webp"
              alt="Sharether"
              className="resource-file-preview-logo"
            />
            <button type="button" className="resource-file-preview-close" onClick={onClose} aria-label="Close preview">
              <FiX />
            </button>
          </div>
        </header>

        <div className={`resource-file-preview-body${isShortContent ? ' resource-file-preview-body--center' : ''}`}>
          {status === 'loading' && <p className="resource-file-preview-hint">Loading preview…</p>}
          {status === 'error' && <p className="resource-file-preview-error">{error || 'Something went wrong.'}</p>}
          {status === 'ready' && mode === 'image' && imageUrl ? (
            <div className="resource-file-preview-image-wrap">
              <img src={imageUrl} alt="" className="resource-file-preview-image" />
            </div>
          ) : null}
          {status === 'ready' && mode === 'pdf' ? (
            <div ref={pagesWrapRef} className="resource-file-preview-pdf" />
          ) : null}
          {status === 'ready' && mode === 'other' ? (
            <p className="resource-file-preview-hint">No in-app preview for this file type. Use Download.</p>
          ) : null}
        </div>

        <div className="resource-file-preview-ctas" aria-label="File actions">
          <button
            type="button"
            className="resource-file-preview-cta"
            onClick={handleDownload}
            disabled={Boolean(actionBusy)}
          >
            <FiDownload aria-hidden="true" />
            <span>{actionBusy === 'download' ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            type="button"
            className="resource-file-preview-cta"
            onClick={handleShare}
            disabled={Boolean(actionBusy)}
          >
            <FiShare2 aria-hidden="true" />
            <span>{actionBusy === 'share' ? 'Sharing...' : 'Share'}</span>
          </button>
          <button
            type="button"
            className="resource-file-preview-cta"
            onClick={handleSaveToPls}
            disabled={Boolean(actionBusy)}
          >
            <FiBookmark aria-hidden="true" />
            <span>{actionBusy === 'save' ? 'Saving...' : 'Save to PLS'}</span>
          </button>
        </div>
        {actionStatus ? (
          <p className="resource-file-preview-action-status" role="status">
            {actionStatus}
          </p>
        ) : null}
        {showSmartGate ? (
          <SmartGate
            onClose={() => setShowSmartGate(false)}
            onContribute={() => setShowSmartGate(false)}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
