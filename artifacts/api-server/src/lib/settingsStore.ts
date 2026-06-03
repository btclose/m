import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface Settings {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  coolifyEndpoint: string;
  refreshInterval: number;
  confirmCloses: boolean;
  hapticFeedback: boolean;
}

const SETTINGS_FILE = join(process.cwd(), "data", "settings.json");

const defaults: Settings = {
  apiKey: "",
  apiSecret: "",
  baseUrl: "https://fapi.bitunix.com",
  coolifyEndpoint: "",
  refreshInterval: 5,
  confirmCloses: true,
  hapticFeedback: true,
};

export class SettingsStore {
  private static instance: SettingsStore;
  private settings: Settings;

  private constructor() {
    this.settings = this.load();
  }

  static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  private load(): Settings {
    try {
      if (existsSync(SETTINGS_FILE)) {
        const raw = readFileSync(SETTINGS_FILE, "utf-8");
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...defaults };
  }

  private save(): void {
    try {
      const dir = join(process.cwd(), "data");
      if (!existsSync(dir)) {
        const { mkdirSync } = require("fs");
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch {}
  }

  get(): Settings {
    return { ...this.settings };
  }

  update(partial: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...partial };
    this.save();
    return { ...this.settings };
  }
}
