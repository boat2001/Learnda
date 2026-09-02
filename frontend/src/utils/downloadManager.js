let activeDownload = false;

export const withDownloadLock = async (task, onBlocked) => {
  if (activeDownload) {
    if (typeof onBlocked === 'function') {
      onBlocked();
    }
    return { blocked: true };
  }

  activeDownload = true;
  try {
    const result = await task();
    return { blocked: false, result };
  } finally {
    activeDownload = false;
  }
};

export const saveBlobAsFile = (blob, filename = 'download') => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
