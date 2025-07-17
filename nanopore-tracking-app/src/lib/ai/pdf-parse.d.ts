declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string
    numpages: number
    info: any
  }
  
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>
  export = pdfParse
} 