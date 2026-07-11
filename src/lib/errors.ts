import type { SourceSearchError } from "./types.js";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

export class CrossSourceSearchError extends Error {
  constructor(readonly sourceErrors: SourceSearchError[]) {
    super("All cross-source searches failed");
    this.name = "CrossSourceSearchError";
  }
}
