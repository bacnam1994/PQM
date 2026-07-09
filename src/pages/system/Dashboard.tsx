import React, { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  Package, Layers, ClipboardCheck, FileText, 
  Activity, ArrowRight, Clock, ShieldAlert, Brain, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DSCard } from '../../components';
import { BATCH_STATUS, PRODUCT_STATUS, TEST_RESULT_STATUS, formatDateStandard } from '../../utils';
import { useShallow } from 'zustand/react/shallow';
import { useQualityAlerts } from '../../hooks/useQualityAlerts';

// Gauge Chart Component with Conic Gradient & Needle Rotation
const GaugeChart: React.FC<{ passRate: number }> = ({ passRate }) => {
  // 0% corresponds to -90deg, 100% corresponds to 90deg
  const needleRotation = -90 + (passRate / 100) * 180;
  
  return (
    <div className="gauge-wrap">
      <div className="gauge-ring"></div>
      <div className="gauge-mask"></div>
      <div className="gauge-ticks">
        <div className="gauge-tick" style={{ transform: 'rotate(-90deg) translate(0,-95px)' }}></div>
        <div className="gauge-tick" style={{ transform: 'rotate(-45deg) translate(0,-95px)' }}></div>
        <div className="gauge-tick" style={{ transform: 'rotate(0deg) translate(0,-95px)' }}></div>
        <div className="gauge-tick" style={{ transform: 'rotate(45deg) translate(0,-95px)' }}></div>
        <div className="gauge-tick" style={{ transform: 'rotate(90deg) translate(0,-95px)' }}></div>
      </div>
      <div className="gauge-needle animate-needle" style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}></div>
      <div className="gauge-label">
        <div className="gauge-value text-zinc-900 dark:text-zinc-50">{passRate}%</div>
        <div className="gauge-caption text-zinc-500 dark:text-emerald-400/80">TỶ LỆ ĐẠT CHỈ TIÊU</div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'testing' | 'rejected'>('all');

  const { products, batches, tccsList, testResultsRealtime, allTestResults, fetchAllTestResultsForDashboard, user } = useAppStore(useShallow(state => ({
    products: state.products,
    batches: state.batches,
    tccsList: state.tccsList,
    testResultsRealtime: state.testResults || [],
    allTestResults: state.allTestResults || [],
    fetchAllTestResultsForDashboard: state.fetchAllTestResultsForDashboard,
    user: state.user
  })));

  // Quality alerts from custom hook
  const { alerts } = useQualityAlerts(30);

  // Fetch all test results once on dashboard mount
  useEffect(() => {
    fetchAllTestResultsForDashboard();
  }, [fetchAllTestResultsForDashboard]);

  // Merge background fetch results + realtime results
  const testResults = useMemo(() => {
    const map = new Map(allTestResults.map(r => [r.id, r]));
    testResultsRealtime.forEach(r => map.set(r.id, r));
    return Array.from(map.values());
  }, [allTestResults, testResultsRealtime]);

  // Aggregate global statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === PRODUCT_STATUS.ACTIVE).length;
    
    let pendingBatches = 0, testingBatches = 0, releasedBatches = 0, rejectedBatches = 0;
    batches.forEach(b => {
       if (b.status === BATCH_STATUS.PENDING) pendingBatches++;
       else if (b.status === BATCH_STATUS.TESTING) testingBatches++;
       else if (b.status === BATCH_STATUS.RELEASED) releasedBatches++;
       else if (b.status === BATCH_STATUS.REJECTED) rejectedBatches++;
    });
    const totalBatches = batches.length;
    
    let passResults = 0;
    testResults.forEach(r => {
       if (r.overallStatus === TEST_RESULT_STATUS.PASS) passResults++;
    });
    const totalResults = testResults.length;
    const totalTCCS = tccsList.length;

    return {
      totalProducts, activeProducts,
      totalBatches, pendingBatches, testingBatches, releasedBatches, rejectedBatches,
      totalResults, passResults,
      totalTCCS
    };
  }, [products, batches, tccsList, testResults]);

  // Calculate percentages
  const passRate = stats.totalResults > 0 ? Math.round((stats.passResults / stats.totalResults) * 100) : 96;

  // Pipeline stage allocation based on actual database statuses and progress
  const pipelineStages = useMemo(() => {
    let pending = 0;     // Nguyên liệu (PENDING)
    let production = 0;  // Sản xuất (TESTING & progress === 0)
    let testing = 0;     // Kiểm nghiệm (TESTING & 0 < progress < 100)
    let review = 0;      // Phê duyệt (TESTING & progress === 100)
    let exported = 0;    // Xuất kho (RELEASED)

    batches.forEach(b => {
      if (b.status === BATCH_STATUS.PENDING) {
        pending++;
      } else if (b.status === BATCH_STATUS.TESTING) {
        const progress = b.progressPercent ?? 0;
        if (progress === 0) {
          production++;
        } else if (progress < 100) {
          testing++;
        } else {
          review++;
        }
      } else if (b.status === BATCH_STATUS.RELEASED) {
        exported++;
      }
    });

    return { pending, production, testing, review, exported };
  }, [batches]);

  // Filtered recent lot records
  const filteredBatches = useMemo(() => {
    let list = [...batches].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (activeTab === 'testing') {
      list = list.filter(b => b.status === BATCH_STATUS.TESTING);
    } else if (activeTab === 'rejected') {
      list = list.filter(b => b.status === BATCH_STATUS.REJECTED);
    }
    return list.slice(0, 5);
  }, [batches, activeTab]);

  // Generate greeting according to current hour
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Ngọc';

  // Trigger global assistant prompt injection
  const triggerAIChat = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('trigger-ai-chat', { detail: { prompt } }));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ================= HERO BANNER ================= */}
      <div className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <Sparkles className="animate-pulse" />
            Tổng quan chất lượng · Hôm nay
          </div>
          <div className="hero-greet">{greeting}, {userName} 👋</div>
          <div className="hero-desc">
            {stats.totalBatches} lô đang được theo dõi trong hệ thống. {alerts.length} chỉ tiêu chất lượng cần chú ý.
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="dot" style={{ background: 'var(--mint-500)' }}></span>
              <b>{stats.releasedBatches}</b>
              <span>Lô đã duyệt</span>
            </div>
            <div className="hero-stat">
              <span className="dot" style={{ background: 'var(--amber-500)' }}></span>
              <b>{stats.testingBatches}</b>
              <span>Đang chờ kiểm</span>
            </div>
            <div className="hero-stat">
              <span className="dot" style={{ background: 'var(--red-500)' }}></span>
              <b>{alerts.length}</b>
              <span>Cảnh báo</span>
            </div>
          </div>
          <Link to="/reports/quality-summary" className="hero-cta">
            <FileText size={15} /> Xem báo cáo tổng hợp
          </Link>
        </div>
        
        <div className="hero-right">
          <GaugeChart passRate={passRate} />
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="kpi-row">
        <div className="kpi-card" style={{ '--accent': 'var(--green-500)' } as React.CSSProperties}>
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'rgba(0,117,58,.1)', color: 'var(--green-600)' }}>
              <Layers />
            </div>
            <div className="kpi-trend trend-up">
              <Sparkles size={10} /> Live
            </div>
          </div>
          <div className="kpi-value">{stats.totalBatches}</div>
          <div className="kpi-label">Lô đang theo dõi trong tháng</div>
          <div className="spark">
            <i style={{ height: '35%' }}></i>
            <i style={{ height: '55%' }}></i>
            <i style={{ height: '40%' }}></i>
            <i style={{ height: '70%' }}></i>
            <i style={{ height: '60%' }}></i>
            <i style={{ height: '90%' }}></i>
            <i style={{ height: '100%' }}></i>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent': 'var(--mint-500)' } as React.CSSProperties}>
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'rgba(16,185,129,.12)', color: 'var(--mint-500)' }}>
              <ClipboardCheck />
            </div>
            <div className="kpi-trend trend-up">
              <Activity size={10} /> {passRate >= 90 ? 'Tốt' : 'Khá'}
            </div>
          </div>
          <div className="kpi-value">{passRate}%</div>
          <div className="kpi-label">Tỷ lệ đạt chỉ tiêu kiểm nghiệm</div>
          <div className="spark">
            <i style={{ height: '70%' }}></i>
            <i style={{ height: '75%' }}></i>
            <i style={{ height: '68%' }}></i>
            <i style={{ height: '80%' }}></i>
            <i style={{ height: '85%' }}></i>
            <i style={{ height: '90%' }}></i>
            <i style={{ height: '96%' }}></i>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent': 'var(--amber-500)' } as React.CSSProperties}>
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'rgba(224,151,42,.13)', color: 'var(--amber-500)' }}>
              <Clock />
            </div>
            <div className="kpi-trend trend-up">
              <Clock size={10} /> Quy trình
            </div>
          </div>
          <div className="kpi-value">{stats.testingBatches}</div>
          <div className="kpi-label">Lô đang kiểm nghiệm tại Lab</div>
          <div className="spark">
            <i style={{ height: '90%' }}></i>
            <i style={{ height: '70%' }}></i>
            <i style={{ height: '60%' }}></i>
            <i style={{ height: '50%' }}></i>
            <i style={{ height: '45%' }}></i>
            <i style={{ height: '35%' }}></i>
            <i style={{ height: '30%' }}></i>
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent': 'var(--red-500)' } as React.CSSProperties}>
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'rgba(214,73,74,.12)', color: 'var(--red-500)' }}>
              <ShieldAlert />
            </div>
            <div className="kpi-trend trend-down">
              <ShieldAlert size={10} /> Cần xử lý
            </div>
          </div>
          <div className="kpi-value">{alerts.length}</div>
          <div className="kpi-label">Cảnh báo chất lượng phát hiện</div>
          <div className="spark">
            <i style={{ height: '20%' }}></i>
            <i style={{ height: '30%' }}></i>
            <i style={{ height: '25%' }}></i>
            <i style={{ height: '40%' }}></i>
            <i style={{ height: '35%' }}></i>
            <i style={{ height: '55%' }}></i>
            <i style={{ height: '65%' }}></i>
          </div>
        </div>
      </div>

      {/* ================= SIGNATURE PIPELINE ================= */}
      <div className="pipeline-card">
        <div className="pipeline-head">
          <div>
            <h2 className="text-zinc-900 dark:text-zinc-50 font-bold">Chuỗi xử lý lô — Từ nguyên liệu đến xuất kho</h2>
            <p>Số lượng lô thực tế phân bổ tại mỗi công đoạn</p>
          </div>
          <Link to="/batches" className="btn-ghost text-zinc-700 dark:text-zinc-300">
            <Layers size={14} /> Xem chi tiết lô
          </Link>
        </div>
        
        <div className="pipeline-track">
          {/* Stage 1: Nguyên liệu */}
          <div className="pl-stage">
            <div className={`pl-connector ${pipelineStages.pending > 0 ? 'filled' : ''}`}></div>
            <div className="pl-node">
              <div className="pl-circle" style={{ borderColor: 'var(--green-500)', color: 'var(--green-600)' }}>
                <Package size={22} />
              </div>
              <div className="pl-count">{pipelineStages.pending}</div>
              <div className="pl-name">Nguyên liệu</div>
              <div className="pl-sub">chờ cấp phép</div>
            </div>
          </div>

          {/* Stage 2: Sản xuất */}
          <div className="pl-stage">
            <div className={`pl-connector ${pipelineStages.production > 0 ? 'filled' : ''}`}></div>
            <div className="pl-node">
              <div className="pl-circle" style={{ borderColor: 'var(--green-500)', color: 'var(--green-600)' }}>
                <Activity size={22} />
              </div>
              <div className="pl-count">{pipelineStages.production}</div>
              <div className="pl-name">Sản xuất</div>
              <div className="pl-sub">đang pha chế</div>
            </div>
          </div>

          {/* Stage 3: Kiểm nghiệm */}
          <div className="pl-stage">
            <div className={`pl-connector ${pipelineStages.testing > 0 ? 'partial' : ''}`}></div>
            <div className="pl-node">
              <div className="pl-circle" style={{ borderColor: 'var(--amber-500)', color: 'var(--amber-500)' }}>
                <ClipboardCheck size={22} />
              </div>
              <div className="pl-count">{pipelineStages.testing}</div>
              <div className="pl-name">Kiểm nghiệm</div>
              <div className="pl-sub">phòng Lab QC</div>
            </div>
          </div>

          {/* Stage 4: Phê duyệt */}
          <div className="pl-stage">
            <div className={`pl-connector ${pipelineStages.review > 0 ? 'filled' : ''}`}></div>
            <div className="pl-node">
              <div className="pl-circle">
                <FileText size={22} />
              </div>
              <div className="pl-count">{pipelineStages.review}</div>
              <div className="pl-name">Phê duyệt</div>
              <div className="pl-sub">chờ QA thẩm định</div>
            </div>
          </div>

          {/* Stage 5: Xuất kho */}
          <div className="pl-stage">
            <div className="pl-node">
              <div className="pl-circle" style={{ borderColor: 'var(--mint-500)', color: 'var(--mint-500)' }}>
                <Layers size={22} />
              </div>
              <div className="pl-count">{pipelineStages.exported}</div>
              <div className="pl-name">Xuất kho</div>
              <div className="pl-sub">đạt chuẩn phát hành</div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TWO COLUMN GRID ================= */}
      <div className="grid-2">
        
        {/* Left Col: Batches List */}
        <div className="card">
          <div className="card-head">
            <h3 className="font-bold">Lô hàng gần đây</h3>
            <Link to="/batches" className="link">Xem tất cả &rarr;</Link>
          </div>
          
          <div className="tabs">
            <span 
              onClick={() => setActiveTab('all')} 
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            >
              Tất cả
            </span>
            <span 
              onClick={() => setActiveTab('testing')} 
              className={`tab ${activeTab === 'testing' ? 'active' : ''}`}
            >
              Đang kiểm
            </span>
            <span 
              onClick={() => setActiveTab('rejected')} 
              className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
            >
              Không đạt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Số lô</th>
                  <th className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sản phẩm</th>
                  <th className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hạn dùng</th>
                  <th className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tiến độ</th>
                  <th className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b) => {
                  const product = products.find(p => p.id === b.productId);
                  let progress = 0;
                  let chipClass = 'chip-review';
                  let statusText = 'Chờ duyệt';
                  
                  if (b.status === BATCH_STATUS.RELEASED) {
                    progress = 100;
                    chipClass = 'chip-pass';
                    statusText = 'Đạt';
                  } else if (b.status === BATCH_STATUS.TESTING) {
                    progress = 65;
                    chipClass = 'chip-testing';
                    statusText = 'Đang kiểm';
                  } else if (b.status === BATCH_STATUS.REJECTED) {
                    progress = 40;
                    chipClass = 'chip-fail';
                    statusText = 'Không đạt';
                  }

                  return (
                    <tr key={b.id} onClick={() => navigate(`/batches/${b.id}`)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 font-mono text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                        {b.batchNo}
                      </td>
                      <td className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800">
                        <div className="prod-name">{product?.name || 'Sản phẩm không rõ'}</div>
                        <div className="prod-sub font-mono">{product?.code || '---'}</div>
                      </td>
                      <td className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800 font-medium text-zinc-650 dark:text-zinc-400">
                        {b.expDate ? b.expDate.split('-').reverse().slice(0, 2).join('/') : '---'}
                      </td>
                      <td className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800">
                        <div className="progress-mini">
                          <span style={{ width: `${progress}%`, background: b.status === BATCH_STATUS.REJECTED ? 'var(--red-500)' : b.status === BATCH_STATUS.TESTING ? 'var(--amber-500)' : 'var(--green-500)' }}></span>
                        </div>
                      </td>
                      <td className="px-5 py-3 border-b border-zinc-200/50 dark:border-zinc-800">
                        <span className={`chip ${chipClass}`}>{statusText}</span>
                      </td>
                    </tr>
                  );
                })}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-zinc-400 font-medium text-xs">
                      Không tìm thấy lô hàng nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Alerts & AI Card */}
        <div className="space-y-4">
          
          {/* Quality Alerts */}
          <div className="card">
            <div className="card-head">
              <h3 className="font-bold">Cảnh báo chất lượng</h3>
              <Link to="/alerts" className="link">Tất cả</Link>
            </div>
            
            <div className="divide-y divide-zinc-200/50 dark:divide-zinc-800/80">
              {alerts.slice(0, 4).map((anomaly, idx) => {
                let severityClass = 'sev-low';
                if (anomaly.severity === 'HIGH') severityClass = 'sev-high';
                else if (anomaly.severity === 'MEDIUM') severityClass = 'sev-mid';

                return (
                  <div key={idx} className="alert-item">
                    <div className={`alert-dot ${severityClass}`}>
                      {anomaly.severity === 'HIGH' ? <ShieldAlert size={15} /> : <Clock size={15} />}
                    </div>
                    <div>
                      <div className="alert-title">{anomaly.title}</div>
                      <div className="alert-meta">
                        {anomaly.detail} {anomaly.batchNo ? `· Lô: ${anomaly.batchNo}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="p-8 text-center text-zinc-400 font-medium text-xs">
                  Không có cảnh báo chất lượng cần xử lý.
                </div>
              )}
            </div>
          </div>

          {/* AI Quick Prompt Widget */}
          <div className="ai-card">
            <div className="ai-head">
              <Brain size={18} />
              <b>Trợ lý AI</b>
            </div>
            <p>Hỏi trợ lý về tình trạng lô, phân tích nguyên nhân gốc (5 Why) hoặc trích xuất dữ liệu kết quả phiếu kiểm nghiệm.</p>
            
            <div 
              onClick={() => triggerAIChat('Tổng quan tình trạng tất cả lô hàng hiện tại')}
              className="ai-prompt"
            >
              <Sparkles size={13} />
              <span>Tổng quan tình trạng tất cả lô hàng hiện tại</span>
            </div>

            <div 
              onClick={() => triggerAIChat('Xuất báo cáo chất lượng tháng này ra Excel')}
              className="ai-prompt"
            >
              <Sparkles size={13} />
              <span>Xuất báo cáo chất lượng tháng này ra Excel</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;