import { useQuery } from '@tanstack/react-query';
import { LABORATORY_QUERY_KEYS } from '../../constants/queryKeys';
import { TestingLaboratory } from '../../types';
import { DEFAULT_TESTING_LABORATORIES } from '../../services/laboratoryService';
import { useAppStore } from '../../store/useAppStore';

export const useTestingLaboratoriesQuery = () => {
  const storeLabs = useAppStore((state) => state.testingLaboratories);
  return useQuery<TestingLaboratory[]>({
    queryKey: LABORATORY_QUERY_KEYS.all,
    queryFn: () => storeLabs || DEFAULT_TESTING_LABORATORIES,
    initialData: storeLabs?.length > 0 ? storeLabs : DEFAULT_TESTING_LABORATORIES,
    staleTime: 1000 * 60 * 30, // 30 phút
  });
};
