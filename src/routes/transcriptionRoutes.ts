// src/repositories/transcription.repository.ts
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import {
  Transcription,
  TranscribeAudioInput,
  TranscribeAudioResponse
} from "../types/transcription.types";

/** TTL for stored transcriptions: 24 hours */
const TRANSCRIPTION_TTL = 60 * 60 * 24; // seconds

export class TranscriptionRepository {
  /** Create + store transcription with TTL */
  async createTranscription(
    userId: string,
    data: Omit<Transcription, "transcriptionId" | "createdAt" | "expiresAt" | "userId"> & { text: string }
  ): Promise<Transcription> {
    const transcriptionId = uuidv4();
    const createdAt = Date.now();
    const expiresAt = Date.now() + TRANSCRIPTION_TTL * 1000;

    const record: Transcription = {
      transcriptionId,
      userId,
      originalFilename: data.originalFilename,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      duration: data.duration,
      text: data.text,
      confidence: data.confidence,
      createdAt,
      expiresAt
    };

    // KV: transcription:{id}
    await kv.set(
      `transcription:${transcriptionId}`,
      record,
      { ex: TRANSCRIPTION_TTL }
    );

    // KV: user_transcriptions:{userId}:{id}
    await kv.set(
      `user_transcriptions:${userId}:${transcriptionId}`,
      true,
      { ex: TRANSCRIPTION_TTL }
    );

    return record;
  }

  /** Get one transcription by ID */
  async getTranscription(transcriptionId: string): Promise<Transcription | null> {
    return await kv.get(`transcription:${transcriptionId}`);
  }

  /** List recent transcriptions for a user */
  async listUserTranscriptions(userId: string): Promise<Transcription[]> {
    const prefix = `user_transcriptions:${userId}:`;
    const results: Transcription[] = [];

    // 使用 kv.scanIterator 遍历用户所有 transcription key
    for await (const key of kv.scanIterator({ match: `${prefix}*` })) {
      const transcriptionId = key.split(":").pop()!;
      const item = await this.getTranscription(transcriptionId);
      if (item) results.push(item);
    }

    // Sort: newest first
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Delete a transcription manually */
  async deleteTranscription(userId: string, transcriptionId: string) {
    await kv.del(`transcription:${transcriptionId}`);
    await kv.del(`user_transcriptions:${userId}:${transcriptionId}`);
  }

  /** Transcribe audio wrapper (mock) */
  async transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResponse> {
    // 可接实际的转录服务OpenAI Whisper
    const transcription = await this.createTranscription(input.userId, {
      originalFilename: input.filename,
      fileSize: input.audioBuffer.length,
      mimeType: "audio/mpeg",
      text: "[MOCK] Transcription text",
    });

    return {
      text: transcription.text,
      fileSize: transcription.fileSize,
      mimeType: transcription.mimeType,
    };
  }
}