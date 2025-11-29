import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Transcription } from '../models/definitions';

export class TranscriptionService {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async transcribeAudio(userId: string, file: Express.Multer.File): Promise<Transcription> {
    // Generate transcription ID
    const transcriptionId = uuidv4();
    const now = new Date().toISOString();

    // Mock transcription process - in real implementation, you would:
    // 1. Send the audio file to a transcription service (OpenAI Whisper, Google Speech-to-Text, etc.)
    // 2. Process the response
    const mockTranscriptionText = "Mock transcription text...";

    // Create transcription object
    const transcription: Transcription = {
      id: transcriptionId,
      userId,
      transcriptionText: mockTranscriptionText,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    };

    // Save to Redis with TTL of 24 hours (86400 seconds)
    await this.redis.setex(
      `transcription:${transcriptionId}`,
      86400,
      JSON.stringify(transcription)
    );

    // Add to user index for easy retrieval
    await this.redis.setex(
      `user_transcriptions:${userId}:${transcriptionId}`,
      86400,
      JSON.stringify({ transcriptionId, createdAt: now })
    );

    return transcription;
  }

  async getTranscription(transcriptionId: string): Promise<Transcription | null> {
    const result = await this.redis.get(`transcription:${transcriptionId}`);
    
    if (!result) {
      return null;
    }

    try {
      return JSON.parse(result) as Transcription;
    } catch (error) {
      console.error('Error parsing transcription from Redis:', error);
      return null;
    }
  }

  async getUserTranscriptions(userId: string): Promise<Transcription[]> {
    // Get all user transcription keys
    const pattern = `user_transcriptions:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    // Get all transcription IDs from the index
    const transcriptionIds: string[] = [];
    
    for (const key of keys) {
      const indexData = await this.redis.get(key);
      if (indexData) {
        try {
          const parsed = JSON.parse(indexData);
          transcriptionIds.push(parsed.transcriptionId);
        } catch (error) {
          console.error('Error parsing transcription index:', error);
        }
      }
    }

    // Get all actual transcriptions
    const transcriptions: Transcription[] = [];
    
    for (const id of transcriptionIds) {
      const transcription = await this.getTranscription(id);
      if (transcription) {
        transcriptions.push(transcription);
      }
    }

    // Sort by creation date (newest first)
    transcriptions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return transcriptions;
  }

  async deleteTranscription(transcriptionId: string): Promise<boolean> {
    // Get transcription to extract userId for index cleanup
    const transcription = await this.getTranscription(transcriptionId);
    
    if (!transcription) {
      return false;
    }

    const userId = transcription.userId;

    // Delete main transcription
    await this.redis.del(`transcription:${transcriptionId}`);
    
    // Delete from user index
    await this.redis.del(`user_transcriptions:${userId}:${transcriptionId}`);

    return true;
  }

  async updateTranscriptionStatus(
    transcriptionId: string, 
    status: Transcription['status']
  ): Promise<Transcription | null> {
    const transcription = await this.getTranscription(transcriptionId);
    
    if (!transcription) {
      return null;
    }

    transcription.status = status;
    transcription.updatedAt = new Date().toISOString();

    // Update in Redis with new TTL (reset to 24 hours)
    await this.redis.setex(
      `transcription:${transcriptionId}`,
      86400,
      JSON.stringify(transcription)
    );

    return transcription;
  }
}