import { budgetTableText, readingOrderText, workTableText, type PdfTextPiece, type PdfRule } from './pdfLayout';

export async function extractTextFromPdf(file: File): Promise<string> {
  // The compatibility build supplies PDF.js's required Map/Set methods in
  // supported browsers that have not implemented the latest built-ins yet.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // getReader also works in Safari versions without async stream iteration.
      const reader = page.streamTextContent().getReader();
      const items: PdfTextPiece[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if ('str' in item) items.push(item);
          }
        }
      } finally {
        reader.releaseLock();
      }
      let table = '';
      if (items.some(item=>item.str.trim()==='Subtotal'||/^Part\s+\d+\s*:/i.test(item.str.trim()))) {
        const operators = await page.getOperatorList();
        const rules: PdfRule[] = [];
        operators.fnArray.forEach((fn,index)=>{
          if(fn!==pdfjsLib.OPS.constructPath)return;
          const box=operators.argsArray[index]?.[2];
          if(box?.length===4)rules.push([box[0],box[1],box[2],box[3]]);
        });
        table=budgetTableText(items,rules,i)+workTableText(items,rules);
        if(!table && ['Category','Particulars','Amount','Subtotal'].every(label=>items.some(item=>item.str.trim()===label)))throw new Error('The PDF budget table could not be read safely. Review or provide a text-based budget table.');
      }
      pages.push(readingOrderText(items)+table);
    }
    return pages.join("\n\n");
  } finally {
    await pdf.destroy();
  }
}
