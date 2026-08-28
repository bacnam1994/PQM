/**
 * BatchGenealogyModal.tsx
 * ========================
 * Modal hiển thị sơ đồ cây truy vết nguồn gốc lô sản xuất.
 * Từ nguyên liệu → công thức → lô → kiểm nghiệm → quyết định.
 */

import React, { useMemo, useState } from 'react';
import {
  X, GitBranch, Package, FlaskConical, FileCheck, TestTube2,
  CheckCircle2, AlertTriangle, Clock, ExternalLink, Shield,
  ChevronRight, ChevronDown, Layers
} from 'lucide-react';
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
  PRODUCT: <Package size={14} />,
  FORMULA: <Layers size={14} />,
  TCCS: <Shield size={14} />,
  RAW_MATERIAL: <FlaskConical size={14} />,
  BATCH: <Package size={16} />,
  TEST_RESULT: <TestTube2 size={14} />,
  DECISION: <FileCheck size={14} />,
};

const STATUS_STYLE: Record<GenealogyNodeStatus, { border: string; dot: string; text: string }> = {
  OK: { border: 'border-emerald-200 dark:border-emerald-700', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  WARNING: { border: 'border-amber-200 dark:border-amber-700', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  FAIL: { border: 'border-red-200 dark:border-red-700', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  PENDING: { border: 'border-slate-200 dark:border-slate-600', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  INFO: { border: 'border-blue-200 dark:border-blue-700', dot: 'bg-blue-400', text: 'text-blue-700 dark:text-blue-400' },
};

const BADGE_COLOR: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
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
          <div className="w-6 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 rounded-bl-lg mr-2" style={{ minHeight: '20px' }}></div>
        </div>
      )}

      {/* Card */}
      <div style={{ marginLeft: `${depth * 24}px` }} className="mb-2">
        <div className={`border rounded-xl transition-all ${style.border} ${node.isKeyNode ? 'shadow-sm' : ''}`}>
          <div
            className={`flex items-center gap-2 px-3 py-2.5 ${hasChildren ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''} rounded-xl`}
            onClick={() => hasChildren && setExpanded(e => !e)}
          >
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}></div>

            {/* Icon + Type */}
            <span className={`text-slate-400 dark:text-slate-500 shrink-0 ${node.isKeyNode ? style.text : ''}`}>
              {NODE_ICON[node.type]}
            </span>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-bold text-sm ${node.isKeyNode ? 'text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>
                  {node.label}
                </span>
                {node.badges?.map((b, i) => (
                  <span key={i} className={`text-[10px] font-black px-2 py-0.5 rounded-full ${BADGE_COLOR[b.color] || BADGE_COLOR.gray}`}>
                    {b.text}
                  </span>
                ))}
              </div>
              {node.sublabel && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{node.sublabel}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {node.navigationPath && (
                <button
                  onClick={e => { e.stopPropagation(); onNavigate(node.navigationPath!); }}
                  className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded text-slate-400 hover:text-indigo-500 transition-colors"
                  title="Xem chi tiết"
                >
                  <ExternalLink size={13} />
                </button>
              )}
              {hasChildren && (
                <span className="text-slate-400">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              )}
            </div>
          </div>

          {/* Detail rows on hover (always show for key nodes) */}
          {node.isKeyNode && (
            <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {Object.entries(node.details)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{k}:</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate">{String(v)}</span>
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
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    HIGH: 'bg-red-100 text-red-700 border-red-200',
  };

  const scoreColor = report.traceabilityScore >= 80 ? 'text-emerald-600' :
                     report.traceabilityScore >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[93vh] flex flex-col border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
              <GitBranch size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-slate-800 dark:text-slate-100 text-base">Truy vết nguồn gốc lô</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.productName} — Lô <span className="font-bold text-indigo-600">{report.batchNo}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4 flex-wrap shrink-0 bg-slate-50 dark:bg-slate-800/50">
          {/* Traceability Score */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Điểm truy vết:</span>
            <span className={`text-lg font-black ${scoreColor}`}>{report.traceabilityScore}/100</span>
          </div>

          {/* Risk */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black ${riskColors[report.overallRisk]}`}>
            {report.overallRisk === 'LOW' ? <CheckCircle2 size={12} /> : report.overallRisk === 'MEDIUM' ? <AlertTriangle size={12} /> : <AlertTriangle size={12} />}
            Rủi ro: {report.overallRisk === 'LOW' ? 'Thấp' : report.overallRisk === 'MEDIUM' ? 'Trung bình' : 'Cao'}
          </div>

          {/* Missing links */}
          {report.missingLinks.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
              <AlertTriangle size={12} />
              {report.missingLinks.length} liên kết thiếu
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0 truncate">{report.summary}</p>
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-6">
          <NodeCard node={report.tree} depth={0} onNavigate={handleNavigate} />

          {/* Missing links panel */}
          {report.missingLinks.length > 0 && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <p className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} /> Liên kết dữ liệu còn thiếu
              </p>
              <ul className="space-y-1">
                {report.missingLinks.map((link, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">•</span>{link}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
