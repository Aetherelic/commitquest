import chalk from "chalk";
import { openDatabase } from "../data/database.js";
import { getProfile, updateProfile } from "../core/profile.js";
import { success, warning } from "../ui/render.js";

export interface ProfileOptions {
  name?: string;
  email?: string;
}

export function profileCommand(options: ProfileOptions): void {
  const db = openDatabase();
  const changed = options.name !== undefined || options.email !== undefined;
  const profile = changed ? updateProfile(db, options) : getProfile(db);

  if (changed) console.log(success("Profile updated."));
  console.log(`\n${chalk.bold(profile.name)}`);
  console.log(profile.email ? chalk.dim(profile.email) : warning("No Git email configured."));
  console.log(chalk.dim("\nOnly commits matching this email earn XP unless cq scan --all-authors is used."));
  db.close();
}
