// Test-only composition of production adapters; this is not a production route.
import "@vibe/core/tokens";
import "@fontsource-variable/figtree/wght.css";
import "../../../src/styles/index.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, IconButton } from "../../../src/app/components/ui/button";
import { FormField, TextInput } from "../../../src/app/components/ui/FormField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../src/app/components/ui/select";
import { Modal } from "../../../src/app/components/ui/Modal";
import { FeatureDialog } from "../../../src/app/components/ui/FeatureDialog";
import { useConfirmation } from "../../../src/app/components/ui/useConfirmation";
import { DataTable } from "../../../src/app/components/ui/DataTable";
import { FeedbackState } from "../../../src/app/components/ui/FeedbackState";
import { ToastProvider, useToast } from "../../../src/app/components/ui/Toast";
import { ActionMenu, WorkspaceTabs } from "../../../src/app/components/ui/workspace";
import { EflowMotionProvider, InspectorPanel } from "../../../src/app/shared/motion";
import { EflowVibeThemeProvider } from "../../../src/app/shared/vibe";
import { Dialog as VibeDialog, DialogContentContainer, Button as VibeButton } from "@vibe/core";
import type { ThemePreference } from "../../../src/app/types";

function Picker() { return <Select defaultValue="planning"><SelectTrigger aria-label="Office picker"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="planning">Planning</SelectItem><SelectItem value="engineering">Engineering</SelectItem></SelectContent></Select>; }
function Proof() {
  const [theme,setTheme] = useState<ThemePreference>("light");
  const [surface,setSurface] = useState<"inspector"|"modal"|"feature"|null>(null);
  const [tab,setTab]=useState("overview"), [pending,setPending]=useState(false),[error,setError]=useState(false),[draft,setDraft]=useState("Unsaved title"),[saves,setSaves]=useState(0),[accepted,setAccepted]=useState(0);
  const saving = useRef(false), {confirm,dialog}=useConfirmation(),{toast}=useToast();
  useEffect(()=>{const media=matchMedia("(prefers-color-scheme: dark)");const apply=()=>document.documentElement.classList.toggle("dark",theme==="dark"||(theme==="system"&&media.matches));apply();media.addEventListener("change",apply);return()=>media.removeEventListener("change",apply);},[theme]);
  const save=async()=>{if(saving.current)return;saving.current=true;setPending(true);setError(false);setSaves(v=>v+1);await new Promise(resolve=>setTimeout(resolve,500));setError(true);setPending(false);saving.current=false;};
  const close=async()=>{if(pending)return;if(await confirm({title:"Discard unsaved changes?",description:"Your draft will be discarded.",actionLabel:"Discard",impact:<><p>One local draft is affected.</p><Picker /></>,danger:true,confirmationText:"DISCARD"})){setAccepted(v=>v+1);setSurface(null);}};
  const contents=<div className="eflow-scroll-region" style={{padding:20,overflow:"auto",display:"grid",gap:16}}><FormField label="Draft title" required description="Changes are saved by the feature" error={error?"Could not save. Your draft is retained.":undefined}><TextInput value={draft} onChange={e=>setDraft(e.target.value)} /></FormField><Picker /><div style={{display:"flex",flexWrap:"wrap",gap:8}}><Button pending={pending} disabledReason="Saving the draft" onClick={()=>void save()}>{pending?"Saving…":"Save draft"}</Button><Button variant="secondary" disabled={pending} onClick={()=>void close()}>Close draft</Button><Button variant="outline" onClick={()=>toast("Draft feedback", "info")}>Notify</Button></div>{error&&<FeedbackState tone="error" title="Save failed" onRetry={()=>void save()} pending={pending}>Your entries are retained.</FeedbackState>}<output aria-label="Save attempts">{saves}</output></div>;
  return <EflowVibeThemeProvider preference={theme}><main style={{padding:24,minHeight:"100dvh",background:"var(--eflow-canvas)",color:"var(--eflow-text)",display:"grid",gap:16}}><h1>Foundation proof</h1><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{(["light","dark","system"] as const).map(value=><Button key={value} variant="secondary" onClick={()=>setTheme(value)}>{value} theme</Button>)}</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}><Button onClick={()=>setSurface("inspector")}>Open inspector</Button><Button onClick={()=>setSurface("modal")}>Open Vibe modal</Button><Button onClick={()=>setSurface("feature")}>Open feature dialog</Button><ActionMenu trigger={<IconButton label="Workspace actions">…</IconButton>} actions={[{id:"locked",label:"Archive",disabled:true,disabledReason:"Linked to audit history",onSelect:()=>{throw new Error("Disabled action ran");}}]} /><div style={{height:44,overflow:"hidden"}}><VibeDialog showTrigger={["click"]} hideTrigger={["click-outside", "esc"]} position="bottom" content={<DialogContentContainer><button type="button">Vibe popup action</button></DialogContentContainer>}><VibeButton>Vibe popup</VibeButton></VibeDialog></div></div><WorkspaceTabs value={tab} onValueChange={setTab} tabs={[{id:"overview",label:"Overview",content:"Overview content"},{id:"activity",label:"Activity",content:"Activity content"}]} /><DataTable density="compact" toolbar={<Button variant="outline">Directory filters</Button>} data={Array.from({length:30},(_,i)=>({id:String(i),name:`Long directory record ${i+1}`}))} columns={[{key:"name",header:"Name",render:item=>item.name,sortable:true,sortValue:item=>item.name},{key:"details",header:"Details",render:()=>"Long directory details with a visible horizontal scrollbar"},{key:"actions",header:"Actions",action:true,render:()=> <Button size="sm">Inspect</Button>}]} keyExtractor={item=>item.id} /><output aria-label="Accepted discards">{accepted}</output><InspectorPanel open={surface==="inspector"} ariaLabel="Foundation inspector" className="w-full sm:w-[480px]" onClose={()=>void close()} preventClose={pending}>{contents}</InspectorPanel><Modal isOpen={surface==="modal"} onClose={()=>void close()} preventClose={pending} title="Foundation Vibe modal">{contents}</Modal><FeatureDialog open={surface==="feature"} title="Foundation feature dialog" onClose={()=>void close()} preventClose={pending}>{contents}</FeatureDialog>{dialog}</main></EflowVibeThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<EflowMotionProvider><ToastProvider><Proof /></ToastProvider></EflowMotionProvider>);
