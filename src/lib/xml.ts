import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false
});

type XmlObject = Record<string, unknown>;

function isRecord(value: unknown): value is XmlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseXml(xml: string): XmlObject {
  return parser.parse(xml) as XmlObject;
}

export function projectOpenSearchXml(xml: string): XmlObject {
  const parsed = parseXml(xml);
  const rss = parsed.rss;

  if (isRecord(rss) && isRecord(rss.channel)) {
    return {
      channel: rss.channel
    };
  }

  if (isRecord(parsed.channel)) {
    return {
      channel: parsed.channel
    };
  }

  return parsed;
}
