export type McpStatus = {
  enabled: boolean;
  running: boolean;
  port: number;
  url: string;
  error: string;
  exportsFolder: string;
  version: string;
  toolCount: number;
  tools: { name: string; description: string; readOnly: boolean }[];
  recent: { name: string; ok: boolean; time: string; duration: number }[];
};
export type LocalAgent = {
  id: string;
  name: string;
  path: string;
  detected: boolean;
  connected: boolean;
  error: string;
  preview: string;
};
declare global {
  interface Window {
    vibeDesktop?: {
      platform: string;
      status(): Promise<McpStatus>;
      setMcp(patch: { enabled?: boolean; port?: number }): Promise<McpStatus>;
      agents(): Promise<LocalAgent[]>;
      copyAgentConfiguration(id: string): Promise<void>;
      configureAgent(id: string, remove?: boolean): Promise<{ backup: string | null; path: string }>;
      showExports(): Promise<string>;
      onStatus(callback: (status: McpStatus) => void): () => void;
      onNavigate(callback: (destination: string) => void): () => void;
      onAutomation(callback: (method: string, args: Record<string, unknown>) => Promise<unknown>): () => void;
    };
  }
}
export const desktop = window.vibeDesktop;
