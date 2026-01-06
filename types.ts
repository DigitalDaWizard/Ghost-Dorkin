
export interface DorkTemplate {
  name: string;
  prompt: string;
  category: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
}

export interface Threat {
  description: string;
  severity: number; // Scale 0.0 - 10.0
}

export interface ScanResult {
  title: string;
  href: string;
  body: string;
  source: string;
}

export type EngineProvider = 'gemini' | 'openrouter' | 'huggingface' | 'brave';

export interface AppConfig {
  scanlines: boolean;
  grid: boolean;
  maxResults: number;
  activeEngine: EngineProvider;
  keys: {
    openrouter: string;
    huggingface: string;
    brave: string;
  };
}

export interface AnalysisResponse {
  summary: string;
  potentialThreats: Threat[];
  recommendations: string[];
}

export enum ScanStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  DORKING = 'DORKING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
