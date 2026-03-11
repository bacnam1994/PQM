import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';

export const useExport = () => {
  const { notify } = useToast();

  const exportToJSON = useCallback((data: any, filename: string) => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify({ type: 'SUCCESS', message: 'Xuất dữ liệu JSON thành công!' });
    } catch (error) {
      console.error("Export JSON error:", error);
      notify({ type: 'ERROR', message: 'Không thể xuất dữ liệu JSON.' });
    }
  }, [notify]);

  const exportToCSV = useCallback((data: any[], filename: string, headers?: string[]) => {
    try {
      if (!data || data.length === 0) {
        notify({ type: 'WARNING', message: 'Không có dữ liệu để xuất.' });
        return;
      }

      // Determine headers if not provided
      const csvHeaders = headers || Object.keys(data[0]);
      
      // Convert data to CSV string
      const csvContent = [
        csvHeaders.join(','), // Header row
        ...data.map(row => 
          csvHeaders.map(header => {
            const cell = row[header] === null || row[header] === undefined ? '' : row[header];
            // Escape quotes and wrap in quotes if contains comma or newline
            const cellStr = String(cell).replace(/"/g, '""');
            return /[,\n"]/.test(cellStr) ? `"${cellStr}"` : cellStr;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify({ type: 'SUCCESS', message: 'Xuất dữ liệu CSV thành công!' });
    } catch (error) {
      console.error("Export CSV error:", error);
      notify({ type: 'ERROR', message: 'Không thể xuất dữ liệu CSV.' });
    }
  }, [notify]);

  return { exportToJSON, exportToCSV };
};