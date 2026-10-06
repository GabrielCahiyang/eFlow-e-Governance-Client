export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
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
      const items: string[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            items.push("str" in item ? item.str || "" : "");
          }
        }
      } finally {
        reader.releaseLock();
      }
      pages.push(items.join(" "));
    }
    return pages.join("\n\n");
  } finally {
    await pdf.destroy();
  }
}
