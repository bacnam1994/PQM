import React from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { StatusBadge } from '../../../../components';

interface BatchStatusSelectProps {
  status: string;
  batchId: string;
  onUpdate: (status: string, batchId: string) => void;
  isAdmin: boolean;
}

export const BatchStatusSelect: React.FC<BatchStatusSelectProps> = ({
  status,
  batchId,
  onUpdate,
  isAdmin,
}) => {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20';
      case 'TESTING':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
      default:
        return 'bg-surface-2 text-ink-muted border-border hover:bg-surface-3';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return ShieldCheckIcon;
      case 'REJECTED':
        return XMarkIcon;
      case 'TESTING':
        return ArrowPathIcon;
      default:
        return ClockIcon;
    }
  };

  const IconComponent = getStatusIcon(status);
  const iconColor = status === 'PENDING' ? 'text-ink-muted' : 'text-current';

  if (!isAdmin) {
    return <StatusBadge type="BATCH" status={status} />;
  }

  return (
    <div className="relative inline-block group/select" onClick={(e) => e.stopPropagation()}>
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`}>
        <IconComponent className={`h-3 w-3 ${status === 'TESTING' ? 'animate-spin' : ''}`} />
      </div>
      <select
        value={status}
        onChange={(e) => onUpdate(e.target.value, batchId)}
        className={`appearance-none pl-6 pr-5 py-1 rounded-full text-xs font-medium border cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors ${getStatusColor(status)}`}
      >
        <option value="PENDING" className="bg-surface text-ink">Chờ kiểm</option>
        <option value="TESTING" className="bg-surface text-ink">Đang kiểm</option>
        <option value="RELEASED" className="bg-surface text-ink">Phê duyệt</option>
        <option value="REJECTED" className="bg-surface text-ink">Từ chối</option>
      </select>
      <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/select:opacity-100 transition-opacity ${iconColor}`}>
        <ChevronUpDownIcon className="h-3 w-3" />
      </div>
    </div>
  );
};
