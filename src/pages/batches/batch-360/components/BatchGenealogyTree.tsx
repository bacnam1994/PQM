import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShareIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon, 
  ChevronRightIcon, 
  ChevronDownIcon, 
  ArrowTopRightOnSquareIcon, 
  ShieldCheckIcon, 
  ShieldExclamationIcon 
} from '@heroicons/react/24/outline';
import { 
  GenealogyNode, 
  GenealogyNodeStatus, 
  BatchGenealogyReport 
} from '../../../../services/ai/batchGenealogyService';

interface BatchGenealogyTreeProps {
  report: BatchGenealogyReport;
}

const statusColorMap: Record<GenealogyNodeStatus, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  OK: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
  },
  WARNING: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
  },
  FAIL: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/5',
    text: 'text-rose-700 dark:text-rose-300',
    icon: <XCircleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
  },
  PENDING: {
    border: 'border-border',
    bg: 'bg-surface-2/60',
    text: 'text-ink-soft',
    icon: <InformationCircleIcon className="w-4 h-4 text-ink-muted" />
  },
  INFO: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <InformationCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
  }
};

const TreeNodeItem: React.FC<{ node: GenealogyNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const statusCfg = statusColorMap[node.status] || statusColorMap.INFO;

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${statusCfg.border} ${statusCfg.bg} hover:shadow-sm`}
        style={{ marginLeft: `${Math.min(depth * 24, 96)}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-surface-3 rounded text-ink-muted transition-colors mt-0.5"
            title={isExpanded ? 'Thu gọn nhánh' : 'Mở rộng nhánh'}
          >
            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-6 h-6 flex items-center justify-center mt-0.5">
            <span className="w-2 h-2 rounded-full bg-ink-muted opacity-40" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              {statusCfg.icon}
              <span>{node.label}</span>
            </div>
            {node.badges?.map((badge, idx) => (
              <span
                key={idx}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  badge.color === 'green' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' :
                  badge.color === 'red' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20' :
                  'bg-surface-3 text-ink-soft border border-border'
                }`}
              >
                {badge.text}
              </span>
            ))}
          </div>

          {node.sublabel && (
            <p className="text-xs text-ink-muted mt-0.5">
              {node.sublabel}
            </p>
          )}

          {node.details && Object.keys(node.details).length > 0 && (
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
              {Object.entries(node.details).map(([k, v]) => v !== undefined && (
                <div key={k} className="flex items-center justify-between gap-2 px-2 py-1 bg-surface/80 rounded border border-border">
                  <span className="text-ink-muted">{k}:</span>
                  <span className="font-medium text-ink truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {node.navigationPath && (
          <Link
            to={node.navigationPath}
            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Xem chi tiết thực thể này"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </Link>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-2 mt-2">
          {node.children!.map((child) => (
            <TreeNodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const BatchGenealogyTree: React.FC<BatchGenealogyTreeProps> = ({ report }) => {
  const score = report.traceabilityScore;
  const scoreColor = 
    score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
    score >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-rose-600 dark:text-rose-400';
  
  const scoreBg = 
    score >= 80 ? 'bg-emerald-500' :
    score >= 50 ? 'bg-amber-500' :
    'bg-rose-500';

  return (
    <div className="space-y-6">
      {/* Thẻ chỉ số truy xuất nguồn gốc */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-ink-muted">Chỉ số truy vết nguồn gốc (Traceability Score)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-sm font-semibold text-ink-muted">/ 100</span>
            </div>
            <div className="w-48 h-2 bg-surface-3 rounded-full mt-2 overflow-hidden">
              <div className={`h-full ${scoreBg} transition-all duration-500`} style={{ width: `${score}%` }} />
            </div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <ShareIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-ink-muted">Mức độ rủi ro chuỗi cung ứng</p>
            <div className="flex items-center gap-2 mt-1.5">
              {report.overallRisk === 'LOW' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <ShieldCheckIcon className="w-3.5 h-3.5" /> THẤP (An toàn)
                </span>
              ) : report.overallRisk === 'MEDIUM' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" /> TRUNG BÌNH
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  <ShieldExclamationIcon className="w-3.5 h-3.5" /> CAO (Cần rà soát)
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-2">
              {report.riskReasons.length > 0 ? `${report.riskReasons.length} cảnh báo rủi ro` : 'Không có rủi ro đáng kể'}
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <ShieldCheckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl border border-border shadow-sm">
          <p className="text-xs font-medium text-ink-muted">Tóm lược cây phả hệ</p>
          <p className="text-xs text-ink-soft mt-1.5 line-clamp-3 leading-relaxed">
            {report.summary || 'Cây gia phả ghi nhận đầy đủ liên kết sản xuất và kiểm nghiệm.'}
          </p>
        </div>
      </div>

      {/* Cảnh báo đứt gãy liên kết nếu có */}
      {report.missingLinks && report.missingLinks.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-sm">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
            <span>Phát hiện liên kết truy vết chưa đầy đủ ({report.missingLinks.length}):</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300 pl-6 list-disc">
            {report.missingLinks.map((link, idx) => (
              <li key={idx}>{link}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cây phả hệ phân cấp */}
      <div className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <ShareIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Cây Phả hệ Truy vết (Genealogy Hierarchy)</span>
          </div>
          <span className="text-xs text-ink-muted">
            Click vào biểu tượng mũi tên để thu gọn / mở rộng từng nhánh
          </span>
        </div>

        <div className="space-y-3">
          <TreeNodeItem node={report.tree} />
        </div>
      </div>
    </div>
  );
};
