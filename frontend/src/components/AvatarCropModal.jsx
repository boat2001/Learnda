import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FiCheck, FiX } from 'react-icons/fi';

function centerSquareCrop(width, height) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
    width,
    height
  );
}

async function getCroppedBlob(imgEl, crop) {
  const canvas = document.createElement('canvas');
  const scaleX = imgEl.naturalWidth / imgEl.width;
  const scaleY = imgEl.naturalHeight / imgEl.height;
  const outputSize = 400;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    imgEl,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize
  );
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export default function AvatarCropModal({ src, onConfirm, onCancel }) {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerSquareCrop(width, height));
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop?.width || !imgRef.current) return;
    const blob = await getCroppedBlob(imgRef.current, completedCrop);
    onConfirm(blob);
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="crop-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Crop profile photo"
    >
      <div className="crop-modal">
        <p className="crop-modal__title">Crop your photo</p>
        <p className="crop-modal__hint">Drag to reposition · Resize from the corner handles</p>
        <div className="crop-modal__canvas">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            keepSelection
          >
            <img
              ref={imgRef}
              src={src}
              onLoad={onImageLoad}
              alt="Crop preview"
              className="crop-modal__image"
            />
          </ReactCrop>
        </div>
        <div className="crop-modal__actions">
          <button type="button" className="crop-btn crop-btn--cancel" onClick={onCancel}>
            <FiX aria-hidden /> Cancel
          </button>
          <button
            type="button"
            className="crop-btn crop-btn--confirm"
            onClick={handleConfirm}
            disabled={!completedCrop?.width}
          >
            <FiCheck aria-hidden /> Use Photo
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
}
