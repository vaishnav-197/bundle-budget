/** A problem with the command line arguments. */
export class UsageError extends Error {
  override name = 'UsageError';
}

/** A problem with the config file, the stats file or the build directory. */
export class InputError extends Error {
  override name = 'InputError';
}
