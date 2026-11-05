/**
 * AnatomyVerificationRig.tsx
 * =========================================================================
 * Mô hình Trạm Thẩm Định Cơ Khí & Niêm Phong 7 Cửa ALCOA+ (Isometric SVG)
 * Triển khai theo tiêu chuẩn Anatomy Skill:
 * - "The object is the explanation"
 * - 4-tone shading (faint, lo, mid, hi, lit)
 * - Khung card chuẩn Plate: Fig 1, Title, Interaction Hint, Live Readout
 * - Đồng hồ so (Dial Indicator), ray trượt tuyến tính, 7 chốt kiểm định GxP
 * =========================================================================
 */

import React, { useState, useMemo } from 'react';

export type RigSimulationState = 'VERIFIED_RELEASE' | 'OOS_BLOCKED' | 'HASH_TAMPERED';

interface AnatomyVerificationRigProps {
  initialState?: RigSimulationState;
  batchNo?: string;
  className?: string;
  compact?: boolean;
}

export const AnatomyVerificationRig: React.FC<AnatomyVerificationRigProps> = ({
  initialState = 'VERIFIED_RELEASE',
  batchNo = 'LOT-2026-682605',
  className = '',
  compact = false,
}) => {
  const [rigState, setRigState] = useState<RigSimulationState>(initialState);
  const [probeOffset, setProbeOffset] = useState<number>(0);

  // Tham số góc quay đồng hồ so & độ dịch chuyển cơ khí dựa trên trạng thái
  const { needleAngle, statusText, statusTone, failGateIndex } = useMemo(() => {
    switch (rigState) {
      case 'VERIFIED_RELEASE':
        return {
          needleAngle: 120 + probeOffset * 15,
          statusText: '7/7 CỔNG HỢP LỆ · CHỮ KÝ SHA-256 NIÊM PHONG · ĐẠT XUẤT XƯỞNG',
          statusTone: 'emerald',
          failGateIndex: -1,
        };
      case 'OOS_BLOCKED':
        return {
          needleAngle: -45,
          statusText: 'CỔNG 3 VI PHẠM (OOS PHÁT HIỆN) · KHÓA FAIL-CLOSED BẢO VỆ',
          statusTone: 'rose',
          failGateIndex: 2, // Gate 3
        };
      case 'HASH_TAMPERED':
        return {
          needleAngle: -80,
          statusText: 'CỔNG 6 CẢNH BÁO: CHỮ KÝ BĂM SNAPSHOT SAI LỆCH · DỮ LIỆU BỊ SỬA LÉN',
          statusTone: 'amber',
          failGateIndex: 5, // Gate 6
        };
    }
  }, [rigState, probeOffset]);

  const gates = [
    { id: 1, name: 'G1: TCCS Chuẩn' },
    { id: 2, name: 'G2: 100% Chỉ tiêu' },
    { id: 3, name: 'G3: 0 OOS/Fail' },
    { id: 4, name: 'G4: Phòng Lab' },
    { id: 5, name: 'G5: Quy tắc thay thế' },
    { id: 6, name: 'G6: SHA-256 Lock' },
    { id: 7, name: 'G7: 21 CFR Part 11' },
  ];

  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* Plate Header (Chuẩn Anatomy Plate: Fig 1 | Title | Status) */}
      <div className="px-5 py-3.5 border-b border-border bg-surface-2/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            FIG 07
          </span>
          <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
            Trạm Cơ Khí Kiểm Định Dược Phẩm & Khóa Niêm Phong 7 Cửa ALCOA+
          </h4>
        </div>
        <div className="text-[11px] font-mono text-ink-muted">
          Lô giám sát: <span className="font-bold text-ink">{batchNo}</span>
        </div>
      </div>

      {/* Main Isometric SVG Canvas */}
      <div className="relative w-full aspect-[16/9] min-h-[300px] max-h-[460px] bg-slate-950 flex items-center justify-center p-2 select-none overflow-hidden">
        <svg
          viewBox="-280 -190 560 380"
          className="w-full h-full max-h-full drop-shadow-2xl"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradients cho bề mặt cơ khí Isometric */}
            <linearGradient id="ironPlate" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="railSteel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="brassPlate" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="roseGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1. HALO NỀN (Shadow halo under base) */}
          <ellipse
            cx="0"
            cy="45"
            rx="240"
            ry="115"
            fill={rigState === 'VERIFIED_RELEASE' ? 'url(#emeraldGlow)' : 'url(#roseGlow)'}
          />

          {/* 2. CHÂN ĐẾ CHỐNG RUNG (Anti-vibration Feet) */}
          {[
            [-180, 20],
            [180, 20],
            [0, -75],
            [0, 110],
          ].map(([fx, fy], idx) => (
            <g key={idx}>
              <ellipse cx={fx} cy={fy + 14} rx="16" ry="8" fill="#090d16" />
              <path
                d={`M ${fx - 14} ${fy + 6} L ${fx + 14} ${fy + 6} L ${fx + 16} ${fy + 14} L ${fx - 16} ${fy + 14} Z`}
                fill="#1e293b"
              />
              <ellipse cx={fx} cy={fy + 6} rx="14" ry="7" fill="#334155" />
            </g>
          ))}

          {/* 3. TẤM ĐẾ KHỐI CƠ KHÍ NẶNG (Heavy Base Plate - Isometric Prism) */}
          {/* Cạnh đáy dưới */}
          <path
            d="M -210 20 L 0 125 L 210 20 L 210 36 L 0 141 L -210 36 Z"
            fill="#090e17"
            stroke="#1e293b"
            strokeWidth="0.8"
          />
          {/* Mặt bên phải */}
          <path d="M 0 125 L 210 20 L 210 36 L 0 141 Z" fill="#0d1527" />
          {/* Mặt bên trái */}
          <path d="M -210 20 L 0 125 L 0 141 L -210 36 Z" fill="#141d33" />
          {/* Mặt trên sàn (Top surface) */}
          <path
            d="M 0 -85 L 210 20 L 0 125 L -210 20 Z"
            fill="url(#ironPlate)"
            stroke="#334155"
            strokeWidth="1.2"
          />

          {/* Vạch khắc thước đo mm trên viền sàn (Ruler ticks) */}
          {Array.from({ length: 25 }).map((_, i) => {
            const t = (i - 12) / 12;
            const tx = t * 140;
            const ty = 125 - Math.abs(t) * 70;
            const isMajor = i % 5 === 0;
            return (
              <line
                key={i}
                x1={tx}
                y1={ty}
                x2={tx + 3}
                y2={ty - (isMajor ? 6 : 3)}
                stroke={isMajor ? '#64748b' : '#334155'}
                strokeWidth={isMajor ? '1' : '0.6'}
              />
            );
          })}

          {/* Ốc vít 4 góc đế với viền vát chamfer */}
          {[
            [-180, 20],
            [180, 20],
            [0, -70],
            [0, 105],
          ].map(([sx, sy], idx) => (
            <g key={idx}>
              <ellipse cx={sx} cy={sy} rx="4" ry="2" fill="#0f172a" />
              <ellipse
                cx={sx}
                cy={sy}
                rx="2.5"
                ry="1.2"
                fill="#475569"
                stroke="#64748b"
                strokeWidth="0.5"
              />
            </g>
          ))}

          {/* TẤM NHÃN ĐỒNG KHẮC TÊN (Brass Engraved Nameplate) */}
          <path
            d="M -50 95 L 50 45 L 50 57 L -50 107 Z"
            fill="url(#brassPlate)"
            stroke="#92400e"
            strokeWidth="0.8"
          />
          <text
            x="0"
            y="79"
            transform="rotate(-26.5 0 79)"
            fill="#fef3c7"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1.2"
            textAnchor="middle"
          >
            PQM-GxP·VERIFY-RIG·2026
          </text>

          {/* 4. HỆ THỐNG 7 CỬA KIỂM ĐỊNH (The 7 Release Gate Pillars) */}
          {gates.map((g, idx) => {
            // Tọa độ isometric của 7 trụ dọc ray kiểm định
            const gx = -135 + idx * 45;
            const gy = -15 + idx * 8;
            const isFailed = idx === failGateIndex;
            const gateColor = isFailed ? '#f43f5e' : '#10b981';
            const pinDropY = isFailed ? -10 : 12; // Chốt thụt lên nếu lỗi, hạ xuống nếu khóa chuẩn

            return (
              <g key={g.id} className="transition-all duration-500">
                {/* Đế chân chốt */}
                <ellipse
                  cx={gx}
                  cy={gy}
                  rx="8"
                  ry="4"
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="0.6"
                />
                {/* Trụ chốt kiểm định bằng thép */}
                <rect
                  x={gx - 4}
                  y={gy - 42}
                  width="8"
                  height="42"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="0.8"
                />
                <path
                  d={`M ${gx - 4} ${gy - 42} L ${gx + 4} ${gy - 42} L ${gx + 6} ${gy - 46} L ${gx - 2} ${gy - 46} Z`}
                  fill="#334155"
                />

                {/* Đèn tín hiệu Gate LED trên đỉnh trụ */}
                <circle
                  cx={gx + 1}
                  cy={gy - 49}
                  r="3.5"
                  fill={gateColor}
                  className={isFailed ? 'animate-pulse' : ''}
                />
                <circle cx={gx + 1} cy={gy - 49} r="6" fill={gateColor} opacity="0.3" />

                {/* Chốt cơ khí trượt (Locking Plunger Pin) */}
                <path
                  d={`M ${gx - 2} ${gy - 20 + pinDropY} L ${gx + 2} ${gy - 20 + pinDropY} L ${gx + 2} ${gy + pinDropY} L ${gx - 2} ${gy + pinDropY} Z`}
                  fill="url(#railSteel)"
                  stroke="#64748b"
                  strokeWidth="0.5"
                />

                {/* Số thứ tự Gate */}
                <text
                  x={gx + 1}
                  y={gy + 14}
                  fill="#94a3b8"
                  fontSize="6.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  G{g.id}
                </text>
              </g>
            );
          })}

          {/* 5. CẶP RAY THÉP TUYẾN TÍNH & XE TRƯỢT CARRIAGE (Linear Rails & Carriage) */}
          {/* Ray sau */}
          <path
            d="M -155 -38 L 155 12"
            stroke="url(#railSteel)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Ray trước */}
          <path
            d="M -145 -18 L 165 32"
            stroke="url(#railSteel)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Xe trượt thẩm định mẫu (Inspection Carriage) di chuyển theo probeOffset */}
          <g
            transform={`translate(${probeOffset * 20}, ${probeOffset * 4})`}
            className="transition-transform duration-300"
          >
            {/* Khối Carriage chính */}
            <path
              d="M -25 -5 L 25 -25 L 25 5 L -25 25 Z"
              fill="#334155"
              stroke="#64748b"
              strokeWidth="1"
            />
            {/* Mặt vát trên của Carriage */}
            <path d="M -25 -5 L 0 -18 L 25 -25 L 0 -12 Z" fill="#475569" />
            {/* Đầu dò cơ khí kim cương chạm mẫu kiểm nghiệm */}
            <ellipse cx="0" cy="5" rx="7" ry="3.5" fill="#0f172a" />
            <path d="M -3 5 L 3 5 L 0 -18 Z" fill="#38bdf8" opacity="0.9" />

            {/* Lò xo đàn hồi giảm chấn (Damper Springs) */}
            {[-18, 18].map((ox, idx) => (
              <path
                key={idx}
                d={`M ${ox} 0 Q ${ox + 4} -5, ${ox} -10 T ${ox} -20 T ${ox} -30`}
                stroke="#94a3b8"
                strokeWidth="1.5"
                fill="none"
              />
            ))}
          </g>

          {/* 6. ĐỒNG HỒ SO ĐIỆN TỬ CƠ KHÍ (The Master Precision Dial Indicator) */}
          <g transform="translate(100, -85)">
            {/* Giá đỡ đồng hồ (Mounting Post) */}
            <path d="M 0 0 L 0 85" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
            <circle cx="0" cy="85" r="7" fill="#1e293b" stroke="#64748b" strokeWidth="1" />

            {/* Tay đòn kẹp có khía nhám (Knurled Thumb Screw) */}
            <rect
              x="-14"
              y="25"
              width="28"
              height="8"
              rx="2"
              fill="#334155"
              stroke="#64748b"
              strokeWidth="0.8"
            />
            <line x1="-10" y1="26" x2="-10" y2="32" stroke="#1e293b" strokeWidth="1" />
            <line x1="0" y1="26" x2="0" y2="32" stroke="#1e293b" strokeWidth="1" />
            <line x1="10" y1="26" x2="10" y2="32" stroke="#1e293b" strokeWidth="1" />

            {/* Vỏ tròn đồng hồ so (Dial Housing with Bevel) */}
            <circle cx="0" cy="0" r="46" fill="#0f172a" stroke="#334155" strokeWidth="4" />
            <circle cx="0" cy="0" r="42" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="39" fill="#f8fafc" />

            {/* Mặt số đo kiểm (Dial Face Ticks & Markings) */}
            {Array.from({ length: 24 }).map((_, i) => {
              const deg = i * 15;
              const rad = (deg * Math.PI) / 180;
              const isMajor = i % 6 === 0;
              const r1 = 38;
              const r2 = isMajor ? 30 : 34;
              return (
                <line
                  key={i}
                  x1={Math.sin(rad) * r1}
                  y1={-Math.cos(rad) * r1}
                  x2={Math.sin(rad) * r2}
                  y2={-Math.cos(rad) * r2}
                  stroke={isMajor ? '#0f172a' : '#64748b'}
                  strokeWidth={isMajor ? '1.5' : '0.8'}
                />
              );
            })}

            {/* Vùng chỉ thị màu PASS (Xanh) và FAIL (Đỏ) */}
            <path d="M 0 0 L 26 -15 A 30 30 0 0 1 28 12 Z" fill="#10b981" opacity="0.35" />
            <path d="M 0 0 L -28 -10 A 30 30 0 0 0 -24 18 Z" fill="#f43f5e" opacity="0.4" />

            {/* Chữ ghi nhãn trên mặt đồng hồ */}
            <text
              x="0"
              y="-14"
              fill="#0f172a"
              fontSize="6.5"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              ALCOA+
            </text>
            <text
              x="0"
              y="-7"
              fill="#64748b"
              fontSize="4.5"
              textAnchor="middle"
              fontFamily="monospace"
            >
              SHA-256 MICRON
            </text>

            {/* Kim đo cơ khí quay động theo trạng thái (The Dial Needle) */}
            <g
              transform={`rotate(${needleAngle} 0 0)`}
              className="transition-transform duration-700 ease-out"
            >
              {/* Kim chính nhọn */}
              <polygon points="0,-33 2.5,0 0,6 -2.5,0" fill="#dc2626" />
              {/* Vòng đối trọng đuôi kim */}
              <circle cx="0" cy="7" r="3" fill="#dc2626" />
            </g>
            {/* Ụ kim trung tâm */}
            <circle cx="0" cy="0" r="3.5" fill="#0f172a" stroke="#dc2626" strokeWidth="0.8" />
          </g>

          {/* 7. DÂY DẪN TÍN HIỆU AN TOÀN (Flexible Shielded Cable) */}
          <path
            d="M 100 0 C 130 30, 160 80, 190 60"
            fill="none"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeDasharray="2,2"
          />
          <circle cx="190" cy="60" r="3" fill="#38bdf8" />
        </svg>

        {/* HUD Indicator Badge góc trên bên phải của Canvas */}
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-lg">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              rigState === 'VERIFIED_RELEASE'
                ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
                : rigState === 'OOS_BLOCKED'
                  ? 'bg-rose-500 animate-ping'
                  : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-mono font-bold text-slate-200">
            {rigState === 'VERIFIED_RELEASE'
              ? 'PASS (RELEASED)'
              : rigState === 'OOS_BLOCKED'
                ? 'BLOCKED (OOS)'
                : 'FAIL-CLOSED (TAMPER)'}
          </span>
        </div>
      </div>

      {/* Plate Footer (Tương tác, Đọc số liệu thời gian thực & Mô phỏng) */}
      <div className="p-4 bg-surface space-y-3.5">
        {/* Live Readout & Hint */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-ink-muted flex items-center gap-1.5">
            <span className="font-semibold text-ink">Gợi ý tương tác:</span>
            <span>Chuyển chế độ mô phỏng bên dưới để quan sát cơ chế khóa an toàn.</span>
          </div>
          <div
            className={`font-mono font-bold text-right text-[11px] ${
              statusTone === 'emerald'
                ? 'text-emerald-600 dark:text-emerald-400'
                : statusTone === 'rose'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {statusText}
          </div>
        </div>

        {/* Thanh điều khiển mô phỏng 3 trạng thái của Trạm kiểm định */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-muted mr-1">Chế độ kiểm định:</span>
            <button
              onClick={() => setRigState('VERIFIED_RELEASE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                rigState === 'VERIFIED_RELEASE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border border-border'
              }`}
            >
              ✓ 7 Cổng Đạt Chuẩn (Release)
            </button>
            <button
              onClick={() => setRigState('OOS_BLOCKED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                rigState === 'OOS_BLOCKED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border border-border'
              }`}
            >
              ⚠ Phát hiện OOS (Chặn Cổng 3)
            </button>
            <button
              onClick={() => setRigState('HASH_TAMPERED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                rigState === 'HASH_TAMPERED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border border-border'
              }`}
            >
              🛡️ Sai lệch băm SHA-256 (Khóa Fail-Closed)
            </button>
          </div>

          {/* Thanh tinh chỉnh vị trí đầu dò (Fine-tuning Slider) */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-ink-muted">Đầu dò micrometer:</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={probeOffset}
              onChange={(e) => setProbeOffset(parseFloat(e.target.value))}
              className="w-24 accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
