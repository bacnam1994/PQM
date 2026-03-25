import React from 'react';
import { Edit2, Trash2, Eye, Copy, Plus } from 'lucide-react';
import { Modal } from './CommonUI';

// --- Action Buttons ---
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
        <button onClick={(e) => { e.stopPropagation(); onView(); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Xem chi tiết">
          <Eye size={16} />
        </button>
      )}
      {onClone && (
        <button onClick={(e) => { e.stopPropagation(); onClone(); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Sao chép">
          <Copy size={16} />
        </button>
      )}
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
          <Edit2 size={16} />
        </button>
      )}
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
          <Trash2 size={16} />
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
    <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận xóa" icon={Trash2} color="bg-red-600">
      <div className="space-y-4">
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-800">
          <p className="font-bold text-sm">Bạn có chắc chắn muốn xóa dữ liệu này?</p>
          {itemName && <p className="text-xs mt-1 font-medium">Mục: <span className="font-black">{itemName}</span></p>}
        </div>
        
        {warningMessage && (
          <p className="text-xs text-slate-500 italic">{warningMessage}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={onClose} 
            disabled={isDeleting}
            className="px-4 py-2 text-slate-500 font-bold text-xs uppercase hover:bg-slate-50 rounded-lg"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white font-bold text-xs uppercase rounded-lg shadow-lg shadow-red-100 hover:bg-red-700 flex items-center gap-2"
          >
            {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- Add Button (Standardized) ---
export const AddButton: React.FC<{ onClick: () => void, label?: string }> = ({ onClick, label = "Thêm mới" }) => (
  <button onClick={onClick} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black shadow-xl transition-all text-xs uppercase tracking-wider">
    <Plus size={18} /> <span>{label}</span>
  </button>
);