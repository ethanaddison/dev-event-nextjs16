import mongoose, { type ConnectOptions } from "mongoose";

function getMongoDbUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Define it in .env.local before connecting to MongoDB."
    );
  }

  return uri;
}

const MONGODB_URI: string = getMongoDbUri();

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Next.js reloads modules in development, so cache on globalThis to reuse one connection.
const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

globalForMongoose.mongooseCache = cached;

const connectionOptions: ConnectOptions = {
  // Fail fast in serverless if a query runs before the connection is ready.
  bufferCommands: false,
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  // Reuse an in-flight connect so concurrent callers share one handshake.
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, connectionOptions);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
