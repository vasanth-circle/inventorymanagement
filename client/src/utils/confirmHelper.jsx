import React from 'react';
import { toast } from 'react-hot-toast';

export const confirmDelete = (message, callback) => {
    return new Promise((resolve) => {
        toast.custom((t) => (
            <div className={`${
                t.visible ? 'animate-enter scale-100 opacity-100' : 'animate-leave scale-95 opacity-0'
            } max-w-[92vw] sm:max-w-md w-full bg-white/80 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-[24px] pointer-events-auto flex flex-col overflow-hidden border border-white transition-all duration-300 transform mt-4 sm:mt-10`}>
                <div className="p-5 sm:p-7">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
                        <div className="flex-shrink-0">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transform -rotate-6">
                                <span className="text-white text-2xl transform rotate-6">⚠️</span>
                            </div>
                        </div>
                        <div className="flex-1 pt-1">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Confirm Action</h3>
                            <p className="mt-2.5 text-sm font-medium text-gray-600 leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>
                
                <div className="px-5 py-4 sm:px-7 sm:py-5 bg-gray-50/50 border-t border-gray-100/50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 backdrop-blur-md">
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            resolve(false);
                        }}
                        className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            if (callback && typeof callback === 'function') {
                                await callback();
                            }
                            resolve(true);
                        }}
                        className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-xl hover:from-rose-600 hover:to-red-700 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md shadow-red-500/20"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        ), {
            duration: Infinity,
            position: 'top-center'
        });
    });
};
