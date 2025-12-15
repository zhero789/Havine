
export enum AppView {
  HOME = 'HOME',
  CONVERTER = 'CONVERTER',
  VIEWER = 'VIEWER'
}

export enum FileType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  DOCUMENT = 'DOCUMENT',
  SPREADSHEET = 'SPREADSHEET',
  ARCHIVE = 'ARCHIVE',
  UNKNOWN = 'UNKNOWN'
}

export interface MediaItem {
  id: string;
  file: File;
  previewUrl: string; // Data URL for images, or null for others
  textContent?: string; // For txt/md/csv files
  type: FileType;
  extension: string;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  keyPoints: string[];
  content: string;
}

export interface PDFData {
  title: string;
  content: string;
  imageUrl?: string; // Data URL
  originalFileName: string;
}

export type ExportFormat = 'PDF' | 'DOCX' | 'TXT' | 'ZIP';
