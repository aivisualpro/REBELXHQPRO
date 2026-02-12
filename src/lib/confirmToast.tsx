import toast from 'react-hot-toast';
import React from 'react';

/**
 * Show a styled toast confirmation dialog with Cancel/Delete buttons.
 * Replaces all window.confirm() / confirm() calls system-wide.
 */
export function confirmDeleteToast(
    message: string,
    onConfirm: () => void | Promise<void>,
    subtitle: string = 'This action cannot be undone.'
) {
    toast((t) => (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-white">{message}</p>
            <p className="text-xs text-gray-400">{subtitle}</p>
            <div className="flex gap-2 mt-1">
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    onClick={() => {
                        toast.dismiss(t.id);
                        onConfirm();
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
                >
                    Delete
                </button>
            </div>
        </div>
    ), {
        duration: 10000,
        position: 'top-center',
        style: {
            maxWidth: '360px',
            background: '#1a1a1a',
            color: '#fff',
            marginTop: '40vh'
        }
    });
}
