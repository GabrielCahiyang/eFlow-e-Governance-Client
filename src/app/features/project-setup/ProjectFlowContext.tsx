import {createContext,type ReactNode} from 'react';
import type {ProjectFlow} from './types';
export interface ProjectFlowState {data?:ProjectFlow;error:string;reload:()=>Promise<void>}
export const ProjectFlowContext=createContext<{projectId:string;flow:ProjectFlowState}|null>(null);
export function ProjectFlowProvider({projectId,flow,children}:{projectId:string;flow:ProjectFlowState;children:ReactNode}){return <ProjectFlowContext.Provider value={{projectId,flow}}>{children}</ProjectFlowContext.Provider>;}
