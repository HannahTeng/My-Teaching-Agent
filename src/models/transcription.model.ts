// src/models/transcription.model.ts
import { Timestamp } from './common.model';

export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Transcription {
  transcriptionId: string;
  userId: string;
  
  // File info
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  duration?: number; // seconds
  
  // Result
  text: string;
  confidence?: number;
  status: TranscriptionStatus;
  
  // Metadata
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export interface CreateTranscriptionInput {
  userId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  text: string;
  confidence?: number;
  status?: TranscriptionStatus;
}

export interface UpdateTranscriptionInput {
  status?: TranscriptionStatus;
  text?: string;
  confidence?: number;
}

export interface TranscribeAudioInput {
  audioBuffer: Buffer;
  userId: string;
  filename: string;
  mimeType: string;
}

export interface TranscribeAudioResponse {
  text: string;
  transcriptionId: string;
  fileSize: number;
  mimeType: string;
}
