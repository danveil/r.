export function saveError(error: unknown): Error {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return new Error(
      'This device is out of storage. Free some space, then try saving again. Your saved history has not been changed.',
    );
  }
  if (error instanceof Error && error.name === 'Error') return error; // Human-readable validation error.
  return new Error(
    'Your changes could not be saved on this device. Please reopen the app and try again. Your existing history has not been changed.',
  );
}
