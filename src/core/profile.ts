import type { CommitQuestDatabase } from "../data/database.js";
import { getMeta, setMeta } from "../data/database.js";

export interface Profile {
  name: string;
  email: string;
}

export function getProfile(db: CommitQuestDatabase): Profile {
  return {
    name: getMeta(db, "profile.name") ?? "Adventurer",
    email: getMeta(db, "profile.email") ?? ""
  };
}

export function updateProfile(db: CommitQuestDatabase, profile: Partial<Profile>): Profile {
  if (profile.name !== undefined) setMeta(db, "profile.name", profile.name);
  if (profile.email !== undefined) setMeta(db, "profile.email", profile.email.toLowerCase());
  return getProfile(db);
}
