import { useCallback,useEffect,useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { ProjectGroup } from '../types';
import { fetchProjectGroups } from '../services/workspaceService';
export function useProjectGroups(projectId:string){
 const [groups,setGroups]=useState<ProjectGroup[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{const rows=await fetchProjectGroups(projectId);setGroups(rows);setError('');},[projectId]);
 useEffect(()=>{let active=true;setLoading(true);setGroups([]);
  const load=async()=>{try{const rows=await fetchProjectGroups(projectId);if(active){setGroups(rows);setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'Could not load project groups.');}finally{if(active)setLoading(false);}};
  void load();const ch=supabase.channel('project-groups-'+projectId).on('postgres_changes',{event:'*',schema:'public',table:'project_groups',filter:'project_id=eq.'+projectId},()=>{void load();}).subscribe();
  return()=>{active=false;void supabase.removeChannel(ch);};
 },[projectId]);return {groups,loading,error,refresh};
}
