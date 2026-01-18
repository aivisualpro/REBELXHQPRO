'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface NoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId?: string; // Optional if we are creating new note from scratch and need to select client, but simpler if passed
    initialNote?: string;
    noteId?: string; // If present, it's an edit
    onSuccess: () => void;
}

export default function NoteModal({ isOpen, onClose, clientId, initialNote = '', noteId, onSuccess }: NoteModalProps) {
    const [note, setNote] = useState(initialNote);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<{ _id: string, name: string }[]>([]);
    const [selectedClientId, setSelectedClientId] = useState(clientId || '');

    useEffect(() => {
        setNote(initialNote);
        setSelectedClientId(clientId || '');
    }, [isOpen, initialNote, clientId]);

    // If no clientId provided (creating new note from main page), fetch clients for dropdown
    useEffect(() => {
        if (isOpen && !clientId) {
            fetch('/api/clients?limit=1000&sortBy=name&sortOrder=asc')
                .then(res => res.json())
                .then(data => {
                    if (data.clients) setClients(data.clients);
                })
                .catch(err => console.error("Failed to load clients", err));
        }
    }, [isOpen, clientId]);


    const handleSubmit = async () => {
        if (!selectedClientId) {
            toast.error('Please select a client');
            return;
        }
        if (!note.trim()) {
            toast.error('Note cannot be empty');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/notes/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    note: note,
                    noteId: noteId // If present, API handles update
                })
            });

            if (res.ok) {
                toast.success(noteId ? 'Note updated' : 'Note created');
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save note');
            }
        } catch {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-lg border border-border shadow-xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 rounded-t-lg shrink-0">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
                        {noteId ? 'Edit Note' : 'New Note'}
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-secondary rounded-sm transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 overflow-visible">
                    {!clientId && (
                        <div className="space-y-1.5 relative z-20">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Client</label>
                            <SearchableSelect 
                                value={selectedClientId}
                                onChange={setSelectedClientId}
                                options={clients.map(c => ({ value: c._id, label: c.name }))}
                                placeholder="Select a Client..."
                                className="w-full"
                            />
                        </div>
                    )}

                    <div className="space-y-1.5 relative z-10">
                        <label className="text-xs font-bold text-muted-foreground uppercase">Note</label>
                        <textarea 
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                            placeholder="Enter note details..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-4 py-3 border-t border-border bg-muted/20 space-x-2 rounded-b-lg shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{loading ? 'Saving...' : 'Save Note'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
