/**
 * BatchGenealogyModal.tsx
 * ========================
 * Modal hiển thị sơ đồ cây truy vết nguồn gốc lô sản xuất.
 * Từ nguyên liệu → công thức → lô → kiểm nghiệm → quyết định.
 */

import React, { useMemo, useState } from 'react';
import {
  XMarkIcon,
  FolderIcon,
  CubeIcon,
  BeakerIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ShieldCheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Square3Stack3DIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { buildBatchGenealogy, GenealogyNode, GenealogyNodeType, GenealogyNodeStatus } from '../../services/ai/batchGenealogyService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batch: any;
  testResults: any[];
}

const NODE_ICON: Record<GenealogyNodeType, React.ReactNode> = {
  PRODUCT: <CubeIcon className="h-4 w-4" />,
  FORMULA: <Square3Stack3DIcon className="h-4 w-4" />,
  TCCS: <ShieldCheckIcon className="h-4 w-4" />,
  RAW_MATERIAL: <BeakerIcon className="h-4 w-4" />,
  BATCH: <FolderIcon className="h-4 w-4" />,
  TEST_RESULT: <BeakerIcon className="h-4 w-4" />,
  DECISION: <DocumentCheckIcon className="h-4 w-4" />,
};

const STATUS_STYLE: Record<GenealogyNodeStatus, { border: string; dot: string; text: string }> = {
  OK: { border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  WARNING: { border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  FAIL: { border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  PENDING: { border: 'border-border', dot: 'bg-ink-muted opacity-40', text: 'text-ink-muted' },
  INFO: { border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
};

const BADGE_COLOR: Record<string, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
  red: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40',
  yellow: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40',
  blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40',
  gray: 'bg-surface-2 text-ink-muted border border-border',
};

interface NodeCardProps {
  node: GenealogyNode;
  depth: number;
  onNavigate: (path: string) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, depth, onNavigate }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children || []).length > 0;
  const style = STATUS_STYLE[node.status] || STATUS_STYLE.INFO;

  return (
    <div className="flex flex-col">
      {/* Connector line */}
      {depth > 0 && (
        <div className="flex items-stretch" style={{ marginLeft: `${(depth - 1) * 24}px` }}>
          <div className="w-6 border-l-2 border-b-2 border-border rounded-bl-lg mr-2" style={{ minHeight: '20px' }}></div>
        </div>
      )}

      {/* Card */}
      <div style={{ marginLeft: `${depth * 24}px` }} className="mb-2">
        <div className={`border rounded-xl transition-all ${style.border} ${node.isKeyNode ? 'shadow-xs bg-surface' : 'bg-surface'}`}>
          <div
            className={`flex items-center gap-2 px-3 py-2.5 ${hasChildren ? 'cursor-pointer hover:bg-surface-2' : ''} rounded-xl`}
            onClick={() => hasChildren && setExpanded(e => !e)}
          >
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}></div>

            {/* Icon + Type */}
            <span className={`text-ink-muted shrink-0 ${node.isKeyNode ? style.text : ''}`}>
              {NODE_ICON[node.type]}
            </span>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold text-xs ${node.isKeyNode ? 'text-ink' : 'text-ink'}`}>
                  {node.label}
                </span>
                {node.badges?.map((b, i) => (
                  <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_COLOR[b.color] || BADGE_COLOR.gray}`}>
                    {b.text}
                  </span>
                ))}
              </div>
              {node.sublabel && (
                <p className="text-xs text-ink-muted mt-0.5">{node.sublabel}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {node.navigationPath && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onNavigate(node.navigationPath!); }}
                  className="p-1 hover:bg-surface-2 rounded text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  title="Xem chi tiết"
                >
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </button>
              )}
              {hasChildren && (
                <span className="text-ink-muted">
                  {expanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                </span>
              )}
            </div>
          </div>

          {/* Detail rows */}
          {node.isKeyNode && (
            <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-border/50 pt-1.5 mt-1">
              {Object.entries(node.details)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-ink-muted shrink-0">{k}:</span>
                    <span className="text-[10px] text-ink truncate">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && expanded && (
          <div className="mt-1">
            {node.children!.map(child => (
              <NodeCard key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const BatchGenealogyModal: React.FC<Props> = ({ isOpen, onClose, batch, testResults }) => {
  const navigate = useNavigate();
  const { products, tccsList, productFormulas, rawMaterials } = useAppStore();
  const { batches: allBatches } = useAppStore();

  const report = useMemo(() => {
    const product = products.find(p => p.id === batch.productId);
    const tccs = tccsList.find(t => t.id === batch.tccsId) ||
                 tccsList.find(t => t.productId === batch.productId && t.isActive);
    const formula = productFormulas.find((f: any) => f.productId === batch.productId);

    return buildBatchGenealogy({
      batch,
      product,
      tccs,
      formula,
      rawMaterials,
      testResults,
      allBatches,
    });
  }, [batch, testResults, products, tccsList, productFormulas, rawMaterials, allBatches]);

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  if (!isOpen) return null;

  const riskColors = {
    LOW: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    MEDIUM: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    HIGH: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40',
  };

  const scoreColor = report.traceabilityScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                     report.traceabilityScore >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[93vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <FolderIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-ink text-base">Truy vết nguồn gốc lô</h2>
              <p className="text-xs text-ink-muted">
                {report.productName} — Lô <span className="font-bold text-emerald-600 dark:text-emerald-400">{report.batchNo}</span>
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-4 flex-wrap shrink-0 bg-surface-2">
          {/* Traceability Score */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted">Điểm truy vết:</span>
            <span className={`text-base font-bold ${scoreColor}`}>{report.traceabilityScore}/100</span>
          </div>

          {/* Risk */}
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${riskColors[report.overallRisk]}`}>
            {report.overallRisk === 'LOW' ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
            Rủi ro: {report.overallRisk === 'LOW' ? 'Thấp' : report.overallRisk === 'MEDIUM' ? 'Trung bình' : 'Cao'}
          </div>

          {/* Missing links */}
          {report.missingLinks.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-bold">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              {report.missingLinks.length} liên kết thiếu
            </div>
          )}

          <p className="text-xs text-ink-muted flex-1 min-w-0 truncate">{report.summary}</p>
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-6">
          <NodeCard node={report.tree} depth={0} onNavigate={handleNavigate} />

          {/* Missing links panel */}
          {report.missingLinks.length > 0 && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                <ExclamationTriangleIcon className="h-4 w-4" /> Liên kết dữ liệu còn thiếu
              </p>
              <ul className="space-y-1">
                {report.missingLinks.map((link, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">•</span>{link}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-2 flex justify-end shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface border border-border rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
