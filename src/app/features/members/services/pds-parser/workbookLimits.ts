import * as XLSX from 'xlsx';
import {attachmentError} from '../../../../shared/fileValidation';
export const MAX_PDS_BYTES=20*1024*1024;
export function pdsFileError(file:File){
 if(!Number.isFinite(file.size)||file.size<=0)return 'Choose a non-empty Excel PDS workbook.';
 return attachmentError([file],{maxMb:20,extensions:['xls','xlsx']})?'Choose an XLS or XLSX Excel workbook no larger than 20 MB.':'';
}
/** Inspect ZIP resource declarations before SheetJS inflates XLSX. */
export function assertWorkbookBytes(data:ArrayBuffer){
 if(!data.byteLength||data.byteLength>MAX_PDS_BYTES)throw new Error('Choose an Excel workbook no larger than 20 MB.');
 const bytes=new Uint8Array(data),view=new DataView(data);
 if(bytes[0]!==0x50||bytes[1]!==0x4b)return;
 let end=-1;for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--)if(view.getUint32(offset,true)===0x06054b50){end=offset;break;}
 if(end<0)throw new Error('The Excel workbook is damaged. Export a new copy.');
 const entries=view.getUint16(end+10,true),central=view.getUint32(end+16,true);
 if(entries>2000||entries===65535)throw new Error('The Excel workbook contains too many embedded files.');
 let position=central,total=0;
 for(let index=0;index<entries;index++){
  if(position+46>bytes.length||view.getUint32(position,true)!==0x02014b50)throw new Error('The Excel workbook is damaged.');
  total+=view.getUint32(position+24,true);
  if(total>MAX_PDS_BYTES*4)throw new Error('The expanded Excel workbook is too large. Remove unused sheets and try again.');
  position+=46+view.getUint16(position+28,true)+view.getUint16(position+30,true)+view.getUint16(position+32,true);
 }
}
export function assertWorkbookBounds(workbook:XLSX.WorkBook){
 if(workbook.SheetNames.length>20)throw new Error('The PDS workbook contains too many sheets.');
 let cells=0;
 for(const sheet of Object.values(workbook.Sheets)){
  const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');cells+=(range.e.r+1)*(range.e.c+1);
  if(range.e.r>=10000||range.e.c>=256||cells>250000)throw new Error('The PDS workbook contains excessive rows or cells. Remove unused cells and try again.');
 }
}
