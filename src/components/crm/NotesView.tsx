'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';
import NoteModal from '@/components/crm/NoteModal';

interface Note {
    clientId: string;
    clientName: string;
    note: string;
    createdBy: string;
    createdAt: string;
    noteId?: string;
}

interface NotesViewProps {
    clientId?: string;
    onNotesUpdate?: () => void;
}

export default function NotesView({ clientId, onNotesUpdate }: NotesViewProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<{ clientId: string, noteId: string, text: string } | undefined>(undefined);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit] = useState(25);
    
    // Search
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: debouncedSearch
            });
            
            if (clientId) {
                queryParams.append('clientId', clientId);
            }

            const res = await fetch(`/api/notes?${queryParams}`);
            const data = await res.json();

            if (data.notes) {
                setNotes(data.notes);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
            toast.error('Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearch, clientId]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const handleDelete = async (clientId: string, noteId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            const res = await fetch(`/api/notes/action?clientId=${clientId}&noteId=${noteId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Note deleted');
                fetchNotes();
                if (onNotesUpdate) onNotesUpdate();
            } else {
                toast.error('Failed to delete note');
            }
        } catch (error) {
            toast.error('Error deleting note');
        }
    };

    const openNewNoteModal = () => {
        setEditingNote(undefined);
        setIsModalOpen(true);
    };

    const openEditNoteModal = (note: Note) => {
        setEditingNote({
            clientId: note.clientId,
            noteId: note.noteId || '',
            text: note.note
        });
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-background text-foreground font-sans">
            
            {/* Header / Action Bar */}
            <div className="flex items-center justify-between px-4 h-9 border-b border-border bg-card sticky top-0 z-20 gap-4">
                
                {/* Left: Search */}
                <div className="flex items-center space-x-6">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search notes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 h-8 w-64 bg-secondary/50 hover:bg-secondary focus:bg-background border border-transparent focus:border-primary rounded text-sm transition-all focus:outline-none placeholder:text-muted-foreground text-foreground"
                        />
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={openNewNoteModal} 
                        className="p-1.5 bg-[#FFEF5F] text-black rounded hover:bg-[#F9E137] transition-all cursor-pointer"
                        title="New Note"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <NoteModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    fetchNotes();
                    if (onNotesUpdate) onNotesUpdate();
                }}
                clientId={clientId || editingNote?.clientId} // Use prop clientId for new notes if available
                noteId={editingNote?.noteId}
                initialNote={editingNote?.text}
            />

            {/* Table Content */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto bg-background transition-colors duration-300 relative scrollbar-custom">
                <div className="min-w-full px-2 py-2 flex flex-col">
                    <table className="w-full border-separate border-spacing-0 text-left relative z-0">
                        <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 backdrop-blur-sm transition-colors">
                            <tr>
                                {!clientId && <th className="p-2 border-b border-border text-[10px] w-48 font-bold text-muted-foreground uppercase tracking-wider">Client</th>}
                                <th className="p-2 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Note</th>
                                <th className="p-2 border-b border-border text-[10px] w-32 font-bold text-muted-foreground uppercase tracking-wider">Created By</th>
                                <th className="p-2 border-b border-border text-[10px] w-32 font-bold text-muted-foreground uppercase tracking-wider text-right">Date</th>
                                <th className="p-2 border-b border-border text-[10px] w-16 font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && notes.length === 0 ? (
                                <tr><td colSpan={clientId ? 4 : 5} className="px-6 py-12 text-center text-sm text-slate-400">Loading...</td></tr>
                            ) : notes.length > 0 ? (
                                notes.map((note, idx) => (
                                    <tr 
                                        key={`${note.clientId}-${idx}`}
                                        className="hover:bg-primary/5 hover:scale-[1.002] transition-all duration-200 group relative z-0 hover:z-10"
                                    >
                                        {/* CLIENT */}
                                        {!clientId && (
                                            <td className="p-2 align-top">
                                                <Link href={`/crm/clients/${note.clientId}`} className="text-[11px] font-bold text-foreground hover:underline">
                                                    {note.clientName}
                                                </Link>
                                            </td>
                                        )}
                                        
                                        {/* NOTE */}
                                        <td className="p-2 align-top">
                                            <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">{note.note}</p>
                                        </td>

                                        {/* CREATED BY */}
                                        <td className="p-2 align-top">
                                            <span className="text-[10px] font-medium text-muted-foreground">{note.createdBy || '-'}</span>
                                        </td>

                                        {/* DATE */}
                                        <td className="p-2 align-top text-right">
                                            <span className="text-[10px] font-medium text-muted-foreground">
                                                {note.createdAt ? new Date(note.createdAt).toLocaleString('en-US', { 
                                                    month: 'short', 
                                                    day: 'numeric', 
                                                    year: 'numeric', 
                                                    hour: 'numeric', 
                                                    minute: 'numeric',
                                                    hour12: true 
                                                }) : '-'}
                                            </span>
                                        </td>
                                        
                                        {/* ACTIONS */}
                                        <td className="p-2 align-top text-right">
                                            <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {note.noteId && (
                                                    <>
                                                        <button 
                                                            onClick={() => openEditNoteModal(note)}
                                                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(note.clientId, note.noteId!)}
                                                            className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={clientId ? 4 : 5} className="p-12 text-center text-slate-400">No notes found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="border-t border-border bg-secondary/30 transition-colors duration-300">
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={total}
                    itemsPerPage={limit}
                    itemName="notes"
                />
            </div>
        </div>
    );
}
