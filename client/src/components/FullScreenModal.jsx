import React from 'react';

/**
 * FullScreenModal – renders a modal that occupies the full viewport on mobile
 * (max-width: 767px) and behaves like a centered dialog on larger screens.
 * Props:
 *   - isOpen: boolean – controls visibility
 *   - onClose: () => void – called when backdrop or close button is clicked
 *   - children: modal body content
 */
const FullScreenModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="full-screen-modal" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>✕</button>
        {children}
      </div>
    </div>
  );
};

export default FullScreenModal;
