/**
 * Barrel file cho thư mục components.
 * Giúp gom nhóm tất cả các UI Component lại một nơi để import dễ dàng và tránh nhầm lẫn.
 */

export * from './ui/CommonUI';
export * from './ui/DesignSystem';
export * from './ui/CrudControls';
export { default as SpecialCharToolbar } from './ui/SpecialCharToolbar';
export { default as ErrorBoundary } from './ui/ErrorBoundary';
export { default as CookieConsentBanner } from './ui/CookieConsentBanner';

export { default as Layout } from './layout/Layout';

export { default as BatchCriteriaHistory } from './features/BatchCriteriaHistory';
export { default as CriteriaInputGroup } from './features/CriteriaInputGroup';
export { AIAssistantChat } from './features/AIAssistantChat';
export { default as MappingConfirmModal } from './features/MappingConfirmModal';
export type { AIExtractedItem, ConfirmedMapping } from './features/MappingConfirmModal';