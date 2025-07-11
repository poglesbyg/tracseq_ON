// Mock database for demo purposes when SQLite setup fails
async function initializeDatabase(): Promise<any> {
  try {
    const { setupDb } = await import('@app/db')
    const { DATABASE_URL } = await import('astro:env/server')
    const database = setupDb(DATABASE_URL)
    console.log('[db] Successfully initialized database')
    return database
  } catch (error) {
    console.log(
      '[db] Database initialization failed, running without database for demo purposes:',
      error instanceof Error ? error.message : String(error),
    )
    // Create a mock database object that returns empty results
    // Using any type for the mock since it's a temporary workaround
    return {
      selectFrom: () => ({
        where: () => ({
          selectAll: () => ({
            execute: () => Promise.resolve([]),
            executeTakeFirst: () => Promise.resolve(null),
            executeTakeFirstOrThrow: () =>
              Promise.reject(new Error('Database not available')),
          }),
        }),
        selectAll: () => ({
          execute: () => Promise.resolve([]),
          executeTakeFirst: () => Promise.resolve(null),
          executeTakeFirstOrThrow: () =>
            Promise.reject(new Error('Database not available')),
        }),
      }),
      insertInto: () => ({
        values: () => ({
          returningAll: () => ({
            execute: () => Promise.resolve([]),
            executeTakeFirst: () => Promise.resolve(null),
            executeTakeFirstOrThrow: () =>
              Promise.reject(new Error('Database not available')),
          }),
        }),
      }),
      updateTable: () => ({
        set: () => ({
          where: () => ({
            returningAll: () => ({
              execute: () => Promise.resolve([]),
              executeTakeFirst: () => Promise.resolve(null),
              executeTakeFirstOrThrow: () =>
                Promise.reject(new Error('Database not available')),
            }),
          }),
        }),
      }),
      deleteFrom: () => ({
        where: () => ({
          execute: () => Promise.resolve([]),
          executeTakeFirst: () => Promise.resolve(null),
          executeTakeFirstOrThrow: () =>
            Promise.reject(new Error('Database not available')),
        }),
      }),
    } as any // Type as any since this is a mock for demo purposes
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const db = await initializeDatabase()
