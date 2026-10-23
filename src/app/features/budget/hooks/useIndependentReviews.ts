import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { DepartmentBudgetBundle } from '../types';
import { getIndependentReview, type IndependentReviewContext } from '../services/independentReviewService';
import { financialErrorMessage } from '../financialReceipts';

export function useIndependentReviews(data: DepartmentBudgetBundle) {
  const { userProfile } = useAuth();
  const packages = data.liquidations.filter(item => item.status === 'pending_department_settlement');
  const identity = `${userProfile?.id}:${data.summary?.orgId}:${data.summary?.fiscalYear}:${JSON.stringify(packages)}:${JSON.stringify(data.requests)}`;
  const [state, setState] = useState<{ key: string; contexts: Record<string, IndependentReviewContext>; errors: Record<string, string> }>({ key: '', contexts: {}, errors: {} });
  const latest = useRef(identity); latest.current = identity;
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++version.current;
    const contexts: Record<string, IndependentReviewContext> = {}, errors: Record<string, string> = {};
    await Promise.all(packages.map(async item => {
      try { contexts[item.id] = await getIndependentReview(item.id); }
      catch (error) { errors[item.id] = financialErrorMessage(error); }
    }));
    if (generation === version.current && latest.current === identity) setState({ key: identity, contexts, errors });
  }, [identity]);
  useEffect(() => { void refresh(); return () => { ++version.current; }; }, [refresh]);
  return { contexts: state.key === identity ? state.contexts : {}, errors: state.key === identity ? state.errors : {}, refresh };
}
