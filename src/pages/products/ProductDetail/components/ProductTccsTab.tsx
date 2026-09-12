import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { TCCS } from '../../../../types';

interface ProductTccsTabProps {
  productTCCSList: TCCS[];
}

export const ProductTccsTab: React.FC<ProductTccsTabProps> = ({ productTCCSList }) => {
  const navigate = useNavigate();

  if (productTCCSList.length === 0) {
    return (
      <div className="p-8 text-center text-ink-muted text-sm italic">
        Chưa có tiêu chuẩn cơ sở (TCCS) nào được đăng ký cho sản phẩm này.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {productTCCSList.map(tccs => (
        <div 
          key={tccs.id} 
          className={`p-5 rounded-xl border transition-all ${
            tccs.isActive 
              ? 'border-emerald-600/50 bg-emerald-500/5' 
              : 'border-border bg-surface'
          } shadow-xs`}
        >
          <div className="flex items-center gap-2 mb-4">
            <DocumentTextIcon className={`h-5 w-5 ${tccs.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted'}`} />
            <h4 className="font-semibold text-ink text-sm">{tccs.code}</h4>
            {tccs.isActive && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase ml-auto">
                Hiệu lực
              </span>
            )}
          </div>
          <div className="space-y-3 mb-4">
             <div className="p-3 bg-surface-2 rounded-xl border border-border text-xs text-ink-muted italic">
               Các chỉ tiêu chất lượng được quy định trong phiên bản này.
             </div>
          </div>
          <div className="flex items-center justify-between mt-6">
             <span className="text-xs font-medium text-ink-muted">
               {(tccs.mainQualityCriteria?.length || 0) + (tccs.safetyCriteria?.length || 0)} Chỉ tiêu
             </span>
             {tccs.standardRefs && (
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded max-w-[120px] truncate border border-emerald-500/20" title={tccs.standardRefs}>
                  {tccs.standardRefs}
                </span>
             )}
             <button 
               onClick={() => navigate(`/tccs/detail/${tccs.id}`)} 
               className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:underline cursor-pointer"
             >
               Chi tiết
             </button>
          </div>
        </div>
      ))}
    </div>
  );
};
