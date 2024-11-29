export type PluginConfig = {
  plugins: Plugin[];
};

export interface Plugin {
  uses: Uses[];
}

export interface Uses {
  plugin: string;
  with: Record<string, unknown>;
}

export interface ManifestPreDecode extends Manifest {
  manifest: Manifest;
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
    default: unknown;
    description?: string;
    items?: {
      type: string;
    };
    properties?: Record<string, Manifest["configuration"]>;
    required?: string[];
  };
  readme?: string;
};
