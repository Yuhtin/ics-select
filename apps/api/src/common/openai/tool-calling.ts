export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
};

export type ToolExecutor = (name: string, args: unknown) => Promise<unknown>;

export type ToolCall = {
  id: string;
  name: string;
  args: unknown;
};
