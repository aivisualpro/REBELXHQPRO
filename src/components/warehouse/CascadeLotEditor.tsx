'use client';

import React, { useState, useEffect } from 'react';
import { Edit2, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface CascadeLotEditorProps {
    skuId: string;
    currentLotNumber: string;
    sourceType: 'Manufacturing' | 'OpeningBalance' | 'AuditAdjustment' | 'PurchaseOrder';
    sourceId: string;
    onLotUpdated?: (newLotNumber: string) => void;
    className?: string;
    disabled?: boolean;
}

interface AffectedDocuments {
    manufacturing: number;
    manufacturingIngredients: number;
    saleOrders: number;
    webOrders: number;
    auditAdjustments: number;
}

export function CascadeLotEditor({
    skuId,
    currentLotNumber,
    sourceType,
    sourceId,
    onLotUpdated,
    className,
    disabled = false
}: CascadeLotEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newLotNumber, setNewLotNumber] = useState(currentLotNumber);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAffected, setIsCheckingAffected] = useState(false);
    const [affectedDocs, setAffectedDocs] = useState<AffectedDocuments | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        setNewLotNumber(currentLotNumber);
    }, [currentLotNumber]);

    const checkAffectedDocuments = async () => {
        if (!skuId || !currentLotNumber || newLotNumber === currentLotNumber) {
            setAffectedDocs(null);
            return;
        }

        setIsCheckingAffected(true);
        try {
            const res = await fetch(
                `/api/warehouse/lots/cascade-update?skuId=${encodeURIComponent(skuId)}&oldLotNumber=${encodeURIComponent(currentLotNumber)}`
            );
            const data = await res.json();
            if (res.ok) {
                setAffectedDocs(data.affectedDocuments);
            }
        } catch (error) {
            console.error('Failed to check affected documents:', error);
        } finally {
            setIsCheckingAffected(false);
        }
    };

    const handleSave = async () => {
        if (newLotNumber === currentLotNumber) {
            setIsEditing(false);
            return;
        }

        // If there are affected documents, show confirmation first
        if (affectedDocs && getTotalAffected(affectedDocs) > 0 && !showConfirm) {
            setShowConfirm(true);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/warehouse/lots/cascade-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skuId,
                    oldLotNumber: currentLotNumber,
                    newLotNumber,
                    sourceType,
                    sourceId
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(
                    data.totalDocumentsUpdated > 0
                        ? `Lot updated! ${data.totalDocumentsUpdated} related document(s) also updated.`
                        : 'Lot number updated successfully'
                );
                setIsEditing(false);
                setShowConfirm(false);
                onLotUpdated?.(newLotNumber);
            } else {
                toast.error(data.error || 'Failed to update lot number');
            }
        } catch (error) {
            console.error('Error updating lot number:', error);
            toast.error('Error updating lot number');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setNewLotNumber(currentLotNumber);
        setIsEditing(false);
        setShowConfirm(false);
        setAffectedDocs(null);
    };

    const getTotalAffected = (docs: AffectedDocuments): number => {
        return docs.manufacturing + docs.manufacturingIngredients + docs.saleOrders + docs.webOrders + docs.auditAdjustments;
    };

    if (!isEditing) {
        return (
            <div className={cn("flex items-center space-x-2", className)}>
                <span className="font-mono text-sm">{currentLotNumber || 'N/A'}</span>
                {!disabled && (
                    <button
                        onClick={() => {
                            setIsEditing(true);
                            checkAffectedDocuments();
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        title="Edit Lot Number"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center space-x-2">
                <input
                    type="text"
                    value={newLotNumber}
                    onChange={(e) => {
                        setNewLotNumber(e.target.value);
                        setShowConfirm(false);
                    }}
                    onBlur={() => checkAffectedDocuments()}
                    className="px-2 py-1 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                    placeholder="Enter lot number"
                    disabled={isLoading}
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading || !newLotNumber.trim()}
                    className="p-1 hover:bg-emerald-100 rounded text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                    title="Save"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="p-1 hover:bg-rose-100 rounded text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
                    title="Cancel"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Affected Documents Preview */}
            {isCheckingAffected && (
                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Checking affected documents...</span>
                </div>
            )}

            {affectedDocs && getTotalAffected(affectedDocs) > 0 && newLotNumber !== currentLotNumber && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold text-amber-800">
                                This will update {getTotalAffected(affectedDocs)} related document(s):
                            </p>
                            <ul className="text-[10px] text-amber-700 space-y-0.5">
                                {affectedDocs.manufacturingIngredients > 0 && (
                                    <li>• {affectedDocs.manufacturingIngredients} Manufacturing job(s) using this as ingredient</li>
                                )}
                                {affectedDocs.saleOrders > 0 && (
                                    <li>• {affectedDocs.saleOrders} Wholesale order(s)</li>
                                )}
                                {affectedDocs.webOrders > 0 && (
                                    <li>• {affectedDocs.webOrders} Web order(s)</li>
                                )}
                                {affectedDocs.auditAdjustments > 0 && (
                                    <li>• {affectedDocs.auditAdjustments} Audit adjustment(s)</li>
                                )}
                            </ul>
                            {showConfirm && (
                                <p className="text-[10px] font-bold text-amber-800 pt-1">
                                    Click the checkmark again to confirm.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
