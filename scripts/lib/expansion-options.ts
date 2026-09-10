export function parseExpansionOptions(args: string[]) {
  const options: {
    help: boolean;
    dryRun: boolean;
    all: boolean;
    limit: number;
    concurrency: number;
    timeout: number;
    ids?: string[];
  } = {
    help: false,
    dryRun: false,
    all: false,
    limit: 100,
    concurrency: 3,
    timeout: 600,
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--help" || flag === "-h") options.help = true;
    else if (flag === "--dry-run") options.dryRun = true;
    else if (flag === "--all") options.all = true;
    else if (flag === "--ids") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw Error("--ids requires comma-separated catalogue IDs");
      options.ids = [...new Set(value.split(",").map((id) => id.trim()))];
      if (options.ids.some((id) => !/^[a-zA-Z0-9_-]+$/.test(id)))
        throw Error("Invalid report ID");
    } else if (["--limit", "--concurrency", "--timeout"].includes(flag)) {
      const value = Number(args[++i]);
      if (!Number.isSafeInteger(value) || value < 1)
        throw Error(`${flag} requires a positive integer`);
      if (flag === "--concurrency" && value > 4)
        throw Error("--concurrency must be between 1 and 4");
      options[flag.slice(2) as "limit" | "concurrency" | "timeout"] = value;
    } else throw Error(`Unknown option: ${flag}. Use --help.`);
  }
  if (options.all && args.includes("--limit"))
    throw Error("Use either --all or --limit");
  return options;
}
