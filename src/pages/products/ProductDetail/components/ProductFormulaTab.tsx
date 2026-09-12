import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { ProductFormula } from '../../../../types';
import { formatDateStandard, parseNumberFromText, getActiveLocale } from '../../../../utils';

interface ProductFormulaTabProps {
  productFormula: ProductFormula | undefined;
  isAdmin: boolean;
}

const formatScientific = (value: string | number) => {
  let num = Number(value);
  if (isNaN(num)) {
    num = parseNumberFromText(String(value));
    if (num === 0 && String(value).trim() !== '0') return value;
  }
  if (num === 0) return value;

  if (Math.abs(num) >= 1000 || (Math.abs(num) > 0 && Math.abs(num) <= 0.001)) {
    const exponent = Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exponent);
    const roundedMantissa = Math.round(mantissa * 1000) / 1000;

    return (
      <span className="whitespace-nowrap">
        {roundedMantissa !== 1 && <>{roundedMantissa} × </>}
        10<sup>{exponent}</sup>
      </span>
    );
  }
  return num.toLocaleString(getActiveLocale());
};

export const ProductFormulaTab: React.FC<ProductFormulaTabProps> = ({
  productFormula,
  isAdmin,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-ink flex items-center gap-2">
          <BeakerIcon className="h-5 w-5 text-emerald-600" />
          Thành phần công thức
        </h3>
        <div className="flex items-center gap-4">
          {productFormula && (
            <span className="text-xs text-ink-muted italic">
              Cập nhật: {formatDateStandard(productFormula.updatedAt)}
            </span>
          )}
          {isAdmin && (
            <button 
              onClick={() => navigate(productFormula ? `/product-formulas/edit/${productFormula.id}` : '/product-formulas/new')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-all border border-emerald-500/20 cursor-pointer"
            >
              {productFormula ? 'Chỉnh sửa' : 'Tạo mới'}
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        {productFormula && productFormula.ingredients.length > 0 ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2/60 border-b border-border text-xs font-semibold text-ink-muted">
              <tr>
                <th className="px-5 py-3">Tên hoạt chất</th>
                <th className="px-5 py-3 text-right">Hàm lượng</th>
                <th className="px-5 py-3 text-center">Đơn vị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productFormula.ingredients.map((ing, idx) => (
                <tr key={idx} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-5 py-3 font-medium text-ink">{ing.name}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatScientific(ing.declaredContent)}
                  </td>
                  <td className="px-5 py-3 text-center text-ink-muted">{ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-ink-muted text-sm italic">
            Chưa có dữ liệu công thức.
          </div>
        )}
      </div>
    </div>
  );
};
