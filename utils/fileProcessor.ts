
import * as mammoth from 'mammoth';

// We'll use a dynamic import for pdfjs to avoid issues if it fails to load
const getPdfText = async (file: File): Promise<string> => {
  try {
    const pdfjs = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file. Please ensure it is not password protected.');
  }
};

const getDocxText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file.');
  }
};

const getTxtText = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read TXT file.'));
    reader.readAsText(file);
  });
};

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return await getPdfText(file);
    case 'docx':
      return await getDocxText(file);
    case 'txt':
      return await getTxtText(file);
    default:
      throw new Error(`Unsupported file format: .${extension}`);
  }
};
