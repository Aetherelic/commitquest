import { statusCommand } from "./status.js";
import { launchTui, shouldUseInteractiveTui } from "../tui/app.js";

export async function dashboardCommand(): Promise<void> {
  if (!shouldUseInteractiveTui()) {
    statusCommand();
    return;
  }

  await launchTui();
}
