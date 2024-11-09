export type PluginConfig = {
  plugins: Plugin[];
};

export interface Plugin {
  uses: Uses[];
}

export interface Uses {
  plugin: string;
  with: With;
}

export interface With extends Record<string, unknown> {}

export interface ManifestPreDecode extends Manifest {
  actionUrl?: string;
  workerUrl?: string;
  error?: string;
}

export type ManifestCache = Record<string, ManifestPreDecode>;

export type Manifest = {
  name: string;
  description: string;
  "ubiquity:listeners": string[];
  commands?: {
    [key: string]: {
      example: string;
      description: string;
    };
  };
  configuration: {
    type: string;
    properties: {
      [key: string]: {
        default: unknown;
        type?: string;
      };
    };
  };
};

export type ManifestProps = { type: string; default: string; items?: { type: string }; properties?: Record<string, ManifestProps> };
