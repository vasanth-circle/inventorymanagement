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
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-200">
        <div className="overflow-y-auto w-full h-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FullScreenModal;
