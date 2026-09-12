import React from 'react';
import { DSFormInput } from '../../../components';
import { SensoryCharacteristics } from '../../../types';

interface FormulaSensorySectionProps {
  sensory?: SensoryCharacteristics;
  packaging?: string;
  storage?: string;
  shelfLife?: string;
}

export const FormulaSensorySection: React.FC<FormulaSensorySectionProps> = ({
  sensory,
  packaging,
  storage,
  shelfLife,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
      <div>
        <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3">
          Thông tin Cảm quan
        </h4>
        <div className="space-y-3">
          <DSFormInput
            label="Dạng bào chế"
            name="dosageForm"
            defaultValue={sensory?.dosageForm}
            placeholder="VD: Viên nang, dung dịch..."
          />
          <DSFormInput label="Màu sắc" name="color" defaultValue={sensory?.color} />
          <DSFormInput label="Mùi vị" name="smellTaste" defaultValue={sensory?.smellTaste} />
          <DSFormInput
            label="Trạng thái / Ngoại quan"
            name="appearance"
            defaultValue={sensory?.appearance}
          />
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-3">
          Thông tin khác
        </h4>
        <div className="space-y-3">
          <DSFormInput label="Quy cách đóng gói" name="packaging" defaultValue={packaging} />
          <DSFormInput label="Điều kiện bảo quản" name="storage" defaultValue={storage} />
          <DSFormInput label="Hạn dùng" name="shelfLife" defaultValue={shelfLife} />
        </div>
      </div>
    </div>
  );
};
