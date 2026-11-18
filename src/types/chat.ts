export type Role = 'user' | 'model' | 'system';

export type AttachmentSource = 'inline' | 'files_api';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  source: AttachmentSource;
  url?: string;
  base64Data?: string;
  fileUri?: string;
  fileName?: string;
  expiresAt?: string | number;
}

export type MessageStatus = 'streaming' | 'complete' | 'stopped' | 'error';

export type ReasoningStepKind =
  | 'thought'
  | 'read'
  | 'analyze'
  | 'write'
  | 'search'
  | 'mail'
  | 'calendar'
  | 'drive'
  | 'memory'
  | 'globe';

export interface ReasoningStep {
  id: string;
  kind: ReasoningStepKind;
  status: 'running' | 'done' | 'error';
  title: string;
  detail?: string;
  content?: string;
  duration?: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface PendingEmailAction {
  type: 'send_email';
  status: 'pending' | 'sent' | 'cancelled';
  payload: {
    to: string;
    subject: string;
    body: string;
  };
}

export interface Message {
  id: string;
  threadId: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  modelUsed?: string;
  status: MessageStatus;
  errorMessage?: string;
  feedback?: 'up' | 'down';
  reasoningSteps?: ReasoningStep[];
  reasoningDuration?: number;
  toolStatus?: string;
  sources?: GroundingSource[];
  generatedImages?: { url: string; prompt: string }[];
  imageResults?: { url: string; description?: string }[];
  pendingAction?: PendingEmailAction;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  cityTimezone: string;
  role: string;
  emailSignature: string;
  communicationRules: string;
}

export interface ArtifactItem {
  id: string;
  title: string;
  language: string;
  versions: string[];
  activeVersionIndex: number;
}

export type TitleStatus = 'pending' | 'generated';

export interface ChatThread {
  id: string;
  title: string;
  titleStatus?: TitleStatus;
  model: string;
  systemInstruction?: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Jasmine Fast',
    badge: 'Fast',
    description: 'Immediate responses for everyday writing, code, and Q&A',
  },
  {
    id: 'gemini-4-hydrogen',
    name: 'Jasmine Pro',
    badge: 'Deep',
    description: 'Thorough reasoning for complex architecture and research',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Jasmine Standard',
    badge: 'Balanced',
    description: 'Balanced multimodal reasoning and synthesis',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.5-flash-lite';

// Gemini API Content schema mapped from Messages
export interface GeminiInlineData {
  inlineData: {
    mimeType: string;
    data: string; // base64 without prefix
  };
}

export interface GeminiFileData {
  fileData: {
    fileUri: string;
    mimeType: string;
  };
}

export interface GeminiTextPart {
  text: string;
}

export type GeminiPart = GeminiTextPart | GeminiInlineData | GeminiFileData;

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}
