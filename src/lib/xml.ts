import { XMLParser, XMLValidator } from "fast-xml-parser";
import { UnsupportedPayloadError } from "./http.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false
});

export type XmlObject = Record<string, unknown>;

export interface XmlPayload {
  text: string;
  contentType: string | null;
}

export interface RssChannelXmlProjection {
  rss: XmlObject | null;
  channel: XmlObject;
  items: XmlObject[];
}

export interface SruXmlResult {
  numberOfRecords: number;
  nextRecordPosition: number | null;
  records: XmlObject[];
  extraResponseData: XmlObject | null;
}

export class InvalidXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXmlError";
  }
}

function isRecord(value: unknown): value is XmlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeContentType(contentType: string | null): string | null {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? null;
}

function looksLikeXmlDocument(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }

  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return false;
  }

  return trimmed.startsWith("<?xml") || /^<[\w:-]+(?:\s|>)/.test(trimmed);
}

function toXmlObject(value: unknown): XmlObject {
  if (isRecord(value)) {
    return value;
  }

  if (value == null) {
    return {};
  }

  return {
    "#text": String(value)
  };
}

function toXmlObjectArray(value: unknown): XmlObject[] {
  if (Array.isArray(value)) {
    return value.map((entry) => toXmlObject(entry));
  }

  if (value == null) {
    return [];
  }

  return [toXmlObject(value)];
}

function requireRssChannel(parsed: XmlObject): {
  rss: XmlObject | null;
  channel: XmlObject;
} {
  const rss = isRecord(parsed.rss) ? parsed.rss : null;
  const channelCandidate = rss?.channel ?? parsed.channel;

  if (!isRecord(channelCandidate)) {
    throw new InvalidXmlError(
      "RSS/XML payload must contain <rss><channel> or <channel> as the document root."
    );
  }

  return {
    rss,
    channel: channelCandidate
  };
}

export function isXmlContentType(contentType: string | null): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return false;
  }

  return (
    normalized === "application/xml" ||
    normalized === "text/xml" ||
    normalized.endsWith("+xml")
  );
}

export function assertXmlPayload(payload: XmlPayload): void {
  const normalized = normalizeContentType(payload.contentType);
  if (normalized && !isXmlContentType(normalized)) {
    throw new UnsupportedPayloadError(
      `XML payload required but received ${payload.contentType}`
    );
  }

  if (!normalized && !looksLikeXmlDocument(payload.text)) {
    throw new UnsupportedPayloadError(
      "XML payload required but upstream returned non-XML content"
    );
  }
}

export function parseXml(xml: string): XmlObject {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new InvalidXmlError(
      `${validation.err.msg}:${validation.err.line}:${validation.err.col}`
    );
  }

  const parsed = parser.parse(xml) as unknown;
  if (!isRecord(parsed)) {
    throw new InvalidXmlError("XML document root must be an object.");
  }

  return parsed;
}

export function parseXmlPayload(payload: XmlPayload): XmlObject {
  assertXmlPayload(payload);

  return parseXml(payload.text);
}

export function projectRssChannelXml(xml: string): RssChannelXmlProjection {
  const parsed = parseXml(xml);
  const { rss, channel } = requireRssChannel(parsed);
  const items = toXmlObjectArray(channel.item);
  const stableChannel = {
    ...channel,
    item: items
  };

  return {
    rss: rss
      ? {
          ...rss,
          channel: stableChannel
        }
      : null,
    channel: stableChannel,
    items
  };
}

export type OpenSearchXmlProjection = RssChannelXmlProjection;

export function projectOpenSearchXml(xml: string): OpenSearchXmlProjection {
  return projectRssChannelXml(xml);
}

export function parseSruXml(xml: string): SruXmlResult {
  const parsed = parseXml(xml);
  const response = isRecord(parsed.searchRetrieveResponse)
    ? parsed.searchRetrieveResponse
    : null;

  if (!response) {
    throw new InvalidXmlError(
      "SRU XML must contain <searchRetrieveResponse> as the document root."
    );
  }

  const numberOfRecords = Number(String(response.numberOfRecords ?? "0"));
  const nextRecordPosition =
    response.nextRecordPosition == null
      ? null
      : Number(String(response.nextRecordPosition));
  const recordsContainer = isRecord(response.records) ? response.records : {};
  const records = toXmlObjectArray(recordsContainer.record);
  const extraResponseData = isRecord(response.extraResponseData)
    ? response.extraResponseData
    : null;

  return {
    numberOfRecords: Number.isFinite(numberOfRecords) ? numberOfRecords : 0,
    nextRecordPosition:
      nextRecordPosition != null && Number.isFinite(nextRecordPosition)
        ? nextRecordPosition
        : null,
    records,
    extraResponseData
  };
}
