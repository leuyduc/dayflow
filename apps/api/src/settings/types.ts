export interface PlannerSettings {
  timeZone: string;
  workingDays: number[];
  workingDayStart: string;
  workingDayEnd: string;
  defaultTaskDurationMinutes: number;
  bufferMinutes: number;
  weekStartsOn: number;
  theme: "system" | "light" | "dark";
  revision: number;
}

export type SettingsPatch = Partial<Omit<PlannerSettings, "revision">>;

export type SettingsResult =
  | { kind: "ok"; settings: PlannerSettings }
  | { kind: "conflict"; settings: PlannerSettings }
  | { kind: "invalid" };

export interface SettingsStore {
  getSettings(userId: string): Promise<PlannerSettings>;
  updateSettings(userId: string, revision: number, patch: SettingsPatch): Promise<SettingsResult>;
}
