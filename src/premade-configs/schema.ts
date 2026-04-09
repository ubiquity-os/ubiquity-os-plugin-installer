/**
 * TypeScript types for premade configurations
 */

export interface PremadeConfig {
  /** Unique identifier for the config */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of what this config provides */
  description: string;
  /** Category for grouping configs */
  category: "standard" | "minimal" | "specialized";
  /** List of plugins included in this configuration */
  plugins: PremadePlugin[];
  /** Optional tags for filtering */
  tags?: string[];
  /** Version of the config format */
  version?: string;
}

export interface PremadePlugin {
  /** Plugin identifier (e.g., 'ubiquity-os-marketplace/plugin-name') */
  plugin: string;
  /** Plugin version or tag (e.g., 'development', 'v1.0.0') */
  version: string;
  /** Whether to skip bot events */
  skipBotEvents?: boolean;
  /** Plugin-specific configuration */
  with?: Record<string, unknown>;
  /** Optional description of what this plugin does */
  description?: string;
}

/**
 * Schema for validating premade config files
 */
export const premadeConfigSchema = {
  type: "object",
  required: ["id", "name", "description", "category", "plugins"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    category: { type: "string", enum: ["standard", "minimal", "specialized"] },
    plugins: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["plugin", "version"],
        properties: {
          plugin: { type: "string", minLength: 1 },
          version: { type: "string", minLength: 1 },
          skipBotEvents: { type: "boolean" },
          with: { type: "object" },
          description: { type: "string" },
        },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    version: { type: "string" },
  },
} as const;
