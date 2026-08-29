import React from 'react';
import MaterialList from './MaterialList';

/**
 * RawMaterialCatalog
 * ==================
 * Hợp nhất và chuyển tiếp về Material Management Hub (MaterialList).
 * Đảm bảo tương thích ngược 100% cho tất cả các liên kết URL cũ (/materials/catalog).
 */
const RawMaterialCatalog: React.FC = () => {
  return <MaterialList />;
};

export default RawMaterialCatalog;