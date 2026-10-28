import React from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentCheckIcon,
  Square3Stack3DIcon,
  ScaleIcon,
  ChartBarIcon,
  CubeIcon,
  SparklesIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface DashboardQuickActionsProps {
  onTriggerAI: (prompt: string) => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({ onTriggerAI }) => {
  const actions = [
    {
      title: 'Nhập phiếu kiểm nghiệm',
      subtitle: 'Trích xuất tự động AI Vision OCR & PDF',
      path: '/test-results/new',
      icon: ClipboardDocumentCheckIcon,
      primary: true,
    },
    {
      title: 'Theo dõi theo Lô',
      subtitle: 'Quản lý lô sản xuất, TCCS và hạn dùng',
      path: '/batches',
      icon: Square3Stack3DIcon,
    },
    {
      title: 'Đối chiếu kết quả Lab',
      subtitle: 'So sánh độ lệch Nội kiểm và Ngoại kiểm',
      path: '/quality/comparison',
      icon: ScaleIcon,
    },
    {
      title: 'Phân tích xu hướng (SPC)',
      subtitle: 'Kiểm soát Cp, Cpk và 8 quy tắc Nelson',
      path: '/reports/trend-analysis',
      icon: ChartBarIcon,
    },
    {
      title: 'Danh mục Sản phẩm 360°',
      subtitle: 'Hồ sơ sản phẩm, TCCS và công thức',
      path: '/products',
      icon: CubeIcon,
    },
    {
      title: 'Trợ lý AI PQM',
      subtitle: 'Hỗ trợ phân tích OOS & tra cứu Dược điển',
      onClick: () => onTriggerAI(''),
      icon: SparklesIcon,
    },
  ];

  return (
    <section aria-label="Thao tác nghiệp vụ nhanh" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Thao tác nghiệp vụ nhanh</h2>
        <span className="text-xs text-ink-muted hidden sm:inline">
          Truy cập trực tiếp các phân hệ trọng tâm
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {actions.map((act, index) => {
          const Icon = act.icon;
          const isPrimary = Boolean(act.primary);
          const content = (
            <div
              className={`h-full p-4 rounded-xl border flex flex-col justify-between group cursor-pointer transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 ${
                isPrimary
                  ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] border-emerald-500/30 hover:border-emerald-500/60 shadow-2xs hover:shadow-md hover:shadow-emerald-500/10'
                  : 'bg-surface/90 dark:bg-surface/85 border-border/80 hover:border-emerald-500/40 shadow-2xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                      isPrimary
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-surface-2 text-ink-soft group-hover:bg-emerald-500/12 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-ink-faint group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-[transform,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                </div>

                <div className="font-semibold text-[13px] text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                  {act.title}
                </div>
                <p className="text-xs text-ink-muted line-clamp-2 mt-1 leading-relaxed">
                  {act.subtitle}
                </p>
              </div>
            </div>
          );

          if (act.path) {
            return (
              <Link key={index} to={act.path} className="block h-full">
                {content}
              </Link>
            );
          }

          return (
            <button
              key={index}
              type="button"
              onClick={act.onClick}
              className="text-left w-full h-full block"
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
};
