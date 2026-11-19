// Only for disposable, isolated desktop test profiles. Never use with a user's app.
export async function closeTestApp(app) {
  let timeout;
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          app.process().kill();
          reject(new Error('The isolated desktop test app did not close within 15 seconds.'));
        }, 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
