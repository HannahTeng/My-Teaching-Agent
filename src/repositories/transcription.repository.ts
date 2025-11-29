// src/repositories/transcription.repository.ts
import { KvCache } from '@liquidmetal-ai/raindrop-framework';
import { 
  Transcription, 
  CreateTranscriptionInput, 
  UpdateTranscriptionInput,
  TranscribeAudioInput,
  TranscribeAudioResponse,
  TranscriptionStatus 
} from '../models/transcription.model';
import { Timestamp } from '../models/common.model';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';

// Transcriptions KV structure:
// ├── transcription:{transcriptionId}
// └── user_transcriptions:{userId}

export class TranscriptionRepository {
  private kv: KvCache;
  private readonly TRANSCRIPTION_PREFIX = 'transcription:';
  private readonly USER_TRANSCRIPTIONS_PREFIX = 'user_transcriptions:';

  constructor(kv: KvCache) {
    this.kv = kv;
  }

  /**
   * Generate a unique transcription ID
   */
  private generateId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Transcribe audio file
   * This is a placeholder implementation - in a real scenario, this would
   * integrate with an actual speech-to-text service
   */
  async transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResponse> {
    const { audioBuffer, userId, filename, mimeType } = input;

    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new ValidationError('Audio buffer is required and cannot be empty');
    }

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!filename) {
      throw new ValidationError('Filename is required');
    }

    if (!mimeType) {
      throw new ValidationError('MIME type is required');
    }

    // Validate file size (max 25MB like in the multer config)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBuffer.length > maxSize) {
      throw new ValidationError('File size exceeds maximum limit of 25MB');
    }

    // Validate MIME type
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/m4a',
      'audio/ogg',
      'audio/webm',
      'audio/x-mpeg-3',
      'audio/x-wav'
    ];

    if (!allowedTypes.includes(mimeType)) {
      throw new ValidationError('Invalid file type. Allowed types: mp3, wav, m4a, ogg, webm');
    }

    // In a real implementation, this would call an external speech-to-text service
    // For now, we'll simulate a transcription
    const transcriptionText = `Transcribed text for ${filename} (${audioBuffer.length} bytes)`;
    const confidence = 0.95; // Mock confidence score

    const now: Timestamp = new Date().toISOString();
    const expiresAt: Timestamp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const transcriptionId = this.generateId();

    const transcription: Transcription = {
      transcriptionId,
      userId,
      originalFilename: filename,
      fileSize: audioBuffer.length,
      mimeType,
      text: transcriptionText,
      confidence,
      status: 'completed' as TranscriptionStatus,
      createdAt: now,
      expiresAt,
    };

    // Store transcription
    const transcriptionKey = `${this.TRANSCRIPTION_PREFIX}${transcriptionId}`;
    await this.kv.put(transcriptionKey, JSON.stringify(transcription));

    // Add to user's transcriptions list
    const userTranscriptionsKey = `${this.USER_TRANSCRIPTIONS_PREFIX}${userId}`;
    const existingUserTranscriptions = await this.kv.get(userTranscriptionsKey);
    const userTranscriptions = existingUserTranscriptions ? JSON.parse(existingUserTranscriptions) : [];
    userTranscriptions.push(transcriptionId);
    await this.kv.put(userTranscriptionsKey, JSON.stringify(userTranscriptions));

    return {
      text: transcriptionText,
      transcriptionId,
      fileSize: audioBuffer.length,
      mimeType,
    };
  }

  /**
   * Get transcription by ID
   */
  async getById(transcriptionId: string): Promise<Transcription> {
    const transcriptionKey = `${this.TRANSCRIPTION_PREFIX}${transcriptionId}`;
    const transcriptionData = await this.kv.get(transcriptionKey);

    if (!transcriptionData) {
      throw new NotFoundError('Transcription', transcriptionId);
    }

    return JSON.parse(transcriptionData) as Transcription;
  }

  /**
   * List transcriptions by user
   */
  async listByUser(userId: string): Promise<Transcription[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const userTranscriptionsKey = `${this.USER_TRANSCRIPTIONS_PREFIX}${userId}`;
    const userTranscriptionsData = await this.kv.get(userTranscriptionsKey);

    if (!userTranscriptionsData) {
      return [];
    }

    const transcriptionIds = JSON.parse(userTranscriptionsData) as string[];
    const transcriptions: Transcription[] = [];

    for (const transcriptionId of transcriptionIds) {
      try {
        const transcription = await this.getById(transcriptionId);
        transcriptions.push(transcription);
      } catch (error) {
        // Skip if transcription not found (could be deleted)
        console.error(`Error fetching transcription ${transcriptionId}:`, error);
      }
    }

    // Sort by creation date (newest first)
    transcriptions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return transcriptions;
  }

  /**
   * Update transcription
   */
  async update(transcriptionId: string, updates: UpdateTranscriptionInput): Promise<Transcription> {
    const existingTranscription = await this.getById(transcriptionId);

    const updatedTranscription: Transcription = {
      ...existingTranscription,
      ...updates,
      transcriptionId: existingTranscription.transcriptionId,
      userId: existingTranscription.userId,
      originalFilename: existingTranscription.originalFilename,
      fileSize: existingTranscription.fileSize,
      mimeType: existingTranscription.mimeType,
      createdAt: existingTranscription.createdAt,
      expiresAt: existingTranscription.expiresAt,
    };

    const transcriptionKey = `${this.TRANSCRIPTION_PREFIX}${transcriptionId}`;
    await this.kv.put(transcriptionKey, JSON.stringify(updatedTranscription));

    return updatedTranscription;
  }

  /**
   * Delete transcription
   */
  async delete(transcriptionId: string): Promise<void> {
    const transcription = await this.getById(transcriptionId);

    // Delete transcription
    const transcriptionKey = `${this.TRANSCRIPTION_PREFIX}${transcriptionId}`;
    await this.kv.delete(transcriptionKey);

    // Remove from user's transcriptions list
    const userTranscriptionsKey = `${this.USER_TRANSCRIPTIONS_PREFIX}${transcription.userId}`;
    const userTranscriptionsData = await this.kv.get(userTranscriptionsKey);
    
    if (userTranscriptionsData) {
      const userTranscriptions = JSON.parse(userTranscriptionsData) as string[];
      const updatedUserTranscriptions = userTranscriptions.filter(id => id !== transcriptionId);
      await this.kv.put(userTranscriptionsKey, JSON.stringify(updatedUserTranscriptions));
    }
  }

  /**
   * Clean up expired transcriptions
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.kv.list({ prefix: this.TRANSCRIPTION_PREFIX });
    let deletedCount = 0;

    for (const key of result.keys) {
      try {
        const transcriptionData = await this.kv.get(key.name);
        if (transcriptionData) {
          const transcription = JSON.parse(transcriptionData) as Transcription;
          if (transcription.expiresAt < now) {
            await this.delete(transcription.transcriptionId);
            deletedCount++;
          }
        }
      } catch (error) {
        console.error(`Error checking expiration for ${key.name}:`, error);
      }
    }

    return deletedCount;
  }
}