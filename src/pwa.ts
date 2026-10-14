export async function registerPwa(
  navigatorLike: Navigator,
  appBaseUrl: string,
): Promise<void> {
  if (!('serviceWorker' in navigatorLike)) return;

  const scope = new URL('./', appBaseUrl).toString();
  const workerUrl = new URL('sw.js', scope).toString();

  try {
    await navigatorLike.serviceWorker.register(workerUrl, { scope });
  } catch {
    // Installation support is optional; payment must keep working if registration fails.
  }
}
