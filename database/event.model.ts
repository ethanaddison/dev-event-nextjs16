import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export const EVENT_MODES = ["online", "offline", "hybrid"] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export interface IEvent {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: EventMode;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const requiredString = {
  type: String,
  required: true,
  trim: true,
} as const;

const requiredStringArray = {
  type: [String],
  required: true,
} as const;

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const REQUIRED_STRING_FIELDS = [
  "title",
  "description",
  "overview",
  "image",
  "venue",
  "location",
  "date",
  "time",
  "mode",
  "audience",
  "organizer",
] as const satisfies ReadonlyArray<keyof IEvent>;

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Unable to generate a URL-friendly slug from title");
  }

  return slug;
}

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date");
  }

  return date;
}

function parseNamedDate(value: string): Date {
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);

  if (!match) {
    throw new Error(`Invalid date: ${value}`);
  }

  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (month === undefined) {
    throw new Error(`Invalid date: ${value}`);
  }

  return utcDate(year, month, day);
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

// Persist dates as ISO-8601 instants, or start/end intervals for multi-day events.
function normalizeDate(value: string): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(trimmed)) {
    return parseIsoDate(trimmed).toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return utcDate(
      Number(trimmed.slice(0, 4)),
      Number(trimmed.slice(5, 7)) - 1,
      Number(trimmed.slice(8, 10))
    ).toISOString();
  }

  if (
    /^\d{4}-\d{2}-\d{2}T.+Z\/\d{4}-\d{2}-\d{2}T.+Z$/.test(trimmed)
  ) {
    const [start, end] = trimmed.split("/");
    const startIso = parseIsoDate(start).toISOString();
    const endIso = parseIsoDate(end).toISOString();

    if (endIso < startIso) {
      throw new Error(`Invalid date range: ${value}`);
    }

    return `${startIso}/${endIso}`;
  }

  const rangeMatch = trimmed.match(
    /^([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s+(\d{4})$/
  );

  if (rangeMatch) {
    const start = parseNamedDate(
      `${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[4]}`
    );
    const end = parseNamedDate(
      `${rangeMatch[1]} ${rangeMatch[3]}, ${rangeMatch[4]}`
    );

    if (end.getTime() < start.getTime()) {
      throw new Error(`Invalid date range: ${value}`);
    }

    return `${start.toISOString()}/${end.toISOString()}`;
  }

  return parseNamedDate(trimmed).toISOString();
}

function parseClock(value: string): string {
  const trimmed = value.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (match12) {
    let hours = Number(match12[1]);
    const minutes = Number(match12[2]);
    const meridiem = match12[4].toUpperCase();

    if (hours < 1 || hours > 12 || minutes > 59) {
      throw new Error(`Invalid time: ${value}`);
    }

    hours =
      meridiem === "AM" ? (hours === 12 ? 0 : hours) : hours === 12 ? 12 : hours + 12;

    return `${pad(hours)}:${pad(minutes)}`;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);

    if (hours > 23 || minutes > 59) {
      throw new Error(`Invalid time: ${value}`);
    }

    return `${pad(hours)}:${pad(minutes)}`;
  }

  throw new Error(`Invalid time: ${value}`);
}

// Store clock times as 24h HH:mm (or HH:mm-HH:mm ranges) and durations as Nh.
function normalizeTime(value: string): string {
  const trimmed = value.trim();
  const duration = trimmed.match(/^(\d+)\s*hours?$/i);

  if (duration) {
    return `${duration[1]}h`;
  }

  const rangeParts = trimmed.split(/\s*[-–—]\s*/);

  if (rangeParts.length === 2) {
    return `${parseClock(rangeParts[0])}-${parseClock(rangeParts[1])}`;
  }

  return parseClock(trimmed);
}

function normalizeStringArray(values: string[], field: string): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${field} must contain at least one value`);
  }

  const normalized = values.map((item) => item.trim());

  if (normalized.some((item) => item.length === 0)) {
    throw new Error(`${field} cannot include empty strings`);
  }

  return normalized;
}

const eventSchema = new Schema<IEvent>(
  {
    title: requiredString,
    // Set in pre-save; Mongoose 9 validates before that hook, so this is not required here.
    slug: { type: String, trim: true, lowercase: true },
    description: requiredString,
    overview: requiredString,
    image: requiredString,
    venue: requiredString,
    location: requiredString,
    date: requiredString,
    time: requiredString,
    mode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: EVENT_MODES,
    },
    audience: requiredString,
    agenda: requiredStringArray,
    organizer: requiredString,
    tags: requiredStringArray,
  },
  { timestamps: true }
);

eventSchema.index({ slug: 1 }, { unique: true });

eventSchema.pre("save", function (this: HydratedDocument<IEvent>) {
  for (const field of REQUIRED_STRING_FIELDS) {
    const value = this[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${field} is required and cannot be empty`);
    }

    this.set(field, value.trim());
  }

  this.agenda = normalizeStringArray(this.agenda, "agenda");
  this.tags = normalizeStringArray(this.tags, "tags");

  // Rebuild the slug only when the title changes (including first save).
  if (this.isModified("title") || !this.slug) {
    this.slug = slugify(this.title);
  }

  if (this.isNew || this.isModified("date")) {
    this.date = normalizeDate(this.date);
  }

  if (this.isNew || this.isModified("time")) {
    this.time = normalizeTime(this.time);
  }
});

export const Event: Model<IEvent> =
  (mongoose.models.Event as Model<IEvent> | undefined) ??
  mongoose.model<IEvent>("Event", eventSchema);
