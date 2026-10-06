import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { projectViewPreferenceKey } from '../preferences';
export function useProjectPresentation<T extends string>(projectId:string, field:string, choices:readonly T[], fallback:T): [T,(value:T)=>void] {
 const { userProfile } = useAuth();
 const key = projectViewPreferenceKey(userProfile?.id || '', projectId) + ':' + field;
 const read = () => { try { const stored = localStorage.getItem(key); return choices.includes(stored as T) ? stored as T : fallback; } catch { return fallback; } };
 const [state,setState] = useState(()=>({key,value:read()}));
 const value = state.key === key ? state.value : read();
 return [value, next => {setState({key,value:next});if (userProfile?.id) try {localStorage.setItem(key,next);} catch { /* Local-only preference. */ }}];
}
