import React from 'react';
import {
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Modal } from './CommonUI';

// --- Action Buttons (Tailwind UI Table Action Buttons) ---
interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClone?: () => void;
  className?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ onView, onEdit, onDelete, onClone, className = '' }) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {onView && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="p-1.5 text-ink-muted hover:text-emerald-600 hover:bg-surface-2 rounded-lg transition-colors"
          title="Xem chi tiết"
          aria-label="Xem chi tiết"
        >
          <EyeIcon className="w-4 h-4" />
        </button>
      )}
      {onClone && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClone(); }}
          className="p-1.5 text-ink-muted hover:text-emerald-600 hover:bg-surface-2 rounded-lg transition-colors"
          title="Sao chép"
          aria-label="Sao chép"
        >
          <DocumentDuplicateIcon className="w-4 h-4" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 text-ink-muted hover:text-emerald-600 hover:bg-surface-2 rounded-lg transition-colors"
          title="Chỉnh sửa"
          aria-label="Chỉnh sửa"
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-ink-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          title="Xóa"
          aria-label="Xóa"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// --- Delete Confirmation Modal ---
interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  warningMessage?: string;
  isDeleting?: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ 
  isOpen, onClose, onConfirm, itemName, warningMessage, isDeleting = false 
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận xóa" icon={TrashIcon} color="bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
      <div className="space-y-4">
        <div className="bg-rose-50/80 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200">
          <p className="font-semibold text-sm">Bạn có chắc chắn muốn xóa dữ liệu này?</p>
          {itemName && <p className="text-xs mt-1 font-normal">Mục: <span className="font-semibold">{itemName}</span></p>}
        </div>
        
        {warningMessage && (
          <p className="text-xs text-ink-muted italic">{warningMessage}</p>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isDeleting}
            className="px-3.5 py-2 text-ink-soft hover:text-ink font-medium text-sm hover:bg-surface-2 rounded-lg transition-colors border border-border"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-rose-600 text-white font-medium text-sm rounded-lg shadow-xs hover:bg-rose-700 active:scale-[0.98] flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- Add Button (Tailwind UI Primary Action Button) ---
export const AddButton: React.FC<{ onClick: () => void, label?: string }> = ({ onClick, label = "Thêm mới" }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg font-medium text-sm shadow-xs transition-all"
  >
    <PlusIcon className="w-4 h-4" /> <span>{label}</span>
  </button>
);