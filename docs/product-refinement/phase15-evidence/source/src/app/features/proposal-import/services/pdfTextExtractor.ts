export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => (item.str as string) || "")
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
}
