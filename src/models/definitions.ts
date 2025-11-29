import { Timestamp } from './common.model';

export interface Transcription extends Timestamp {
  id: string;
  userId: string;
  transcriptionText: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}