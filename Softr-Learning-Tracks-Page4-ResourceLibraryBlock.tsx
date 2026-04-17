/**
 * Page 4 – Block C: Resource Library (custom resource card formatting + nav).
 * Data source: Resource Library (Airtable table).
 * Use with: 1) Section Content block, 2) ResourcesOnly block, 3) this block. Reads resourceIds from URL (set by ResourcesOnly). Fetches full records and renders cards by type (PDF, Contact, Video, etc.) + Prev/Next when section has linked resources.
 */
import React, { useMemo, useRef, useState } from "react";
import { useRecords, q } from "@/lib/datasource";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, ArrowRight, FileText, Image as ImageIcon, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const resourcesSelect = q.select({
  title: "Resource Title",
  description: "Description",
  resourceDescription: "Resource Description",
  type: "Resource Type",
  photo: "Resource Photo",
  link: "Resource Link",
  documentation: "Resource Documentation",
  date: "Date",
  surveyLink: "Survey Link",
  recordId: "RecordID",
  backstageLink: "Backstage Link",
  siteLink: "Site Link",
  url: "URL",
  profilePhoto: "Profile Photo",
  avatar: "Avatar",
  contactPhoto: "Contact Photo",
  image: "Image",
});

function getParamsFromUrl() {
  if (typeof window === "undefined") {
    return { recordId: null, courseId: null, trackId: null, sectionIds: [], resourceIds: [], personId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const sectionIds = params.get("sectionIds");
  const resourceIdsParam = params.get("resourceIds");
  return {
    recordId: params.get("recordId"),
    courseId: params.get("courseId"),
    trackId: params.get("trackId"),
    sectionIds: sectionIds ? sectionIds.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
    resourceIds: resourceIdsParam ? resourceIdsParam.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
    personId: params.get("personId"),
  };
}

function getResourceTitle(raw, o) {
  if (raw && raw["Resource Title"] != null && String(raw["Resource Title"]).trim()) return String(raw["Resource Title"]).trim();
  if (o && o["Resource Title"] != null && String(o["Resource Title"]).trim()) return String(o["Resource Title"]).trim();
  if (raw && raw.title != null && String(raw.title).trim()) return String(raw.title).trim();
  if (o && o.title != null && String(o.title).trim()) return String(o.title).trim();
  for (var key in raw || {}) { if (key.toLowerCase().indexOf("resource") !== -1 && key.toLowerCase().indexOf("title") !== -1 && raw[key] != null && String(raw[key]).trim()) return String(raw[key]).trim(); }
  for (var key in o || {}) { if (key.toLowerCase().indexOf("resource") !== -1 && key.toLowerCase().indexOf("title") !== -1 && o[key] != null && String(o[key]).trim()) return String(o[key]).trim(); }
  if (o && o.label != null && String(o.label).trim()) return String(o.label).trim();
  if (o && o.name != null && String(o.name).trim()) return String(o.name).trim();
  if (raw && raw.label != null && String(raw.label).trim()) return String(raw.label).trim();
  if (raw && raw.name != null && String(raw.name).trim()) return String(raw.name).trim();
  return "Resource";
}

function stripYearSuffix(s) {
  if (s == null || typeof s !== "string") return s;
  return s.replace(/\s*-\s*20\d{2}\s*$/, "").trim() || s;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function blockElementToHtml(el) {
  if (!el || typeof el !== "object") return "";
  var text = el.text != null ? String(el.text) : el.content != null ? String(el.content) : "";
  text = escapeHtml(text);
  if (el.bold) text = "<strong>" + text + "</strong>";
  if (el.italic) text = "<em>" + text + "</em>";
  if (el.link) return '<a href="' + escapeHtml(el.link) + '" target="_blank" rel="noopener noreferrer">' + text + "</a>";
  return text;
}
function blocksToHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  var out = [];
  var inList = false;
  var listTag = "ul";
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var type = (b && b.type) ? String(b.type).toLowerCase() : "";
    var text = (b && (b.text != null ? b.text : b.content != null ? b.content : ""));
    if (b && Array.isArray(b.elements)) {
      text = b.elements.map(blockElementToHtml).join("");
    } else if (text != null) {
      var str = String(text);
      text = (/\*\*[^*]*\*\*|\[[^\]]+\]\([^)]+\)/.test(str) ? markdownToHtml(str) : escapeHtml(str));
    } else {
      text = "";
    }
    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      if (!inList) { inList = true; listTag = type === "numbered_list_item" ? "ol" : "ul"; out.push("<" + listTag + " style=\"list-style-type:" + (listTag === "ol" ? "decimal" : "disc") + ";padding-left:1.5rem;margin:0.35rem 0 0.5rem 0\">"); }
      out.push("<li style=\"display:list-item;margin:0.25rem 0\">" + text + "</li>");
    } else {
      if (inList) { out.push("</" + listTag + ">"); inList = false; }
      if (type === "heading_1") out.push("<p style=\"margin:0.5rem 0 0.25rem 0;font-weight:700;font-size:1.25em\">" + text + "</p>");
      else if (type === "heading_2") out.push("<p style=\"margin:0.5rem 0 0.25rem 0;font-weight:600;font-size:1.1em\">" + text + "</p>");
      else out.push("<p style=\"margin:0.35rem 0 0.5rem 0;line-height:1.6\">" + (text || "&nbsp;") + "</p>");
    }
  }
  if (inList) out.push("</" + listTag + ">");
  return out.join("\n");
}

var linkPlaceholderPrefix = "\u0001L";
var linkPlaceholderSuffix = "L\u0001";
function linkToAnchor(url) {
  var safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  var text = url.replace(/&/g, "&amp;");
  return "<a href=\"" + safe + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline\">" + text + "</a>";
}
function markdownToHtml(md) {
  if (!md || typeof md !== "string") return "";
  var out = md;
  out = out.replace(/\\_/g, "_").replace(/\\\*/g, "*");
  var linkUrls = [];
  out = out.replace(/<(https?:\/\/[^>\s]+)>/gi, function (m, url) {
    linkUrls.push(url);
    return linkPlaceholderPrefix + (linkUrls.length - 1) + linkPlaceholderSuffix;
  });
  out = out.replace(/(^|\s)(https?:\/\/[^\s<>)\]]+)/gi, function (m, before, url) {
    if (!url || /^https?:\/\/$/i.test(url)) return m;
    linkUrls.push(url);
    return before + linkPlaceholderPrefix + (linkUrls.length - 1) + linkPlaceholderSuffix;
  });
  out = out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\u0001L(\d+)L\u0001/g, function (m, idx) {
    return linkToAnchor(linkUrls[Number(idx)]);
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">$1</a>');
  var lines = out.split(/\r?\n/);
  var expanded = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (/\d+\.\s+.*\d+\.\s+/.test(line)) {
      var parts = line.split(/(?=\d+\.\s+)/);
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j].trim();
        if (p) expanded.push(p);
      }
    } else {
      expanded.push(line);
    }
  }
  lines = expanded;
  var result = [];
  var listStack = [];
  var lastWasLi = false;
  var ulStyle = "list-style-type:disc;padding-left:3rem;margin:0.25rem 0 0 1rem;list-style-position:outside";
  var olStyle = "list-style-type:decimal;padding-left:3rem;margin:0.25rem 0 0 1rem;list-style-position:outside";
  var ulStyleNested = "list-style-type:disc;padding-left:1.5rem;margin:0.25rem 0 0 0.5rem;list-style-position:outside";
  var olStyleNested = "list-style-type:decimal;padding-left:1.5rem;margin:0.25rem 0 0 0.5rem;list-style-position:outside";
  function closeListsToLevel(level) {
    while (listStack.length > level + 1) {
      if (lastWasLi) { result.push("</li>"); lastWasLi = false; }
      result.push("</" + listStack.pop() + ">");
    }
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    var numberedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    var listMatch = bulletMatch || numberedMatch;
    if (listMatch) {
      var indent = listMatch[1].length;
      var level = Math.floor(indent / 2);
      var content = listMatch[2].trim();
      var isOl = !!numberedMatch;
      var wantTag = isOl ? "ol" : "ul";
      closeListsToLevel(level);
      if (listStack.length > level && listStack[listStack.length - 1] !== wantTag) {
        if (lastWasLi) { result.push("</li>"); lastWasLi = false; }
        result.push("</" + listStack.pop() + ">");
      }
      if (lastWasLi && listStack.length < level + 1) { result.push("</li>"); lastWasLi = false; }
      while (listStack.length < level + 1) {
        var tag = listStack.length === level ? wantTag : "ul";
        var isNested = listStack.length > 0;
        var style = tag === "ol" ? (isNested ? olStyleNested : olStyle) : (isNested ? ulStyleNested : ulStyle);
        result.push("<" + tag + " style=\"" + style + "\">");
        listStack.push(tag);
      }
      if (lastWasLi) result.push("</li>");
      result.push("<li style=\"display:list-item;margin:0.25rem 0\">" + content);
      lastWasLi = true;
    } else {
      closeListsToLevel(0);
      if (lastWasLi) { result.push("</li>"); lastWasLi = false; }
      while (listStack.length > 0) { result.push("</" + listStack.pop() + ">"); }
      var t = line.trim();
      result.push(t === "" ? "<p style=\"margin:0.35rem 0;line-height:1.6\">&nbsp;</p>" : "<p style=\"margin:0.35rem 0 0.5rem 0;line-height:1.6\">" + t + "</p>");
    }
  }
  if (lastWasLi) result.push("</li>");
  while (listStack.length > 0) { result.push("</" + listStack.pop() + ">"); }
  return result.join("\n");
}

function isDocumentUrl(url) {
  if (!url || typeof url !== "string") return false;
  var u = String(url).split("?")[0].split("#")[0];
  return /\.(doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i.test(u) || /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(u);
}

function hrefMatchesResourceDocUrl(href, resourceDocUrl) {
  if (!href || !resourceDocUrl) return false;
  var h = String(href).trim();
  var d = String(resourceDocUrl).trim();
  if (h === d) return true;
  try {
    if (decodeURIComponent(h) === decodeURIComponent(d)) return true;
  } catch (e) {}
  if (h.indexOf(d) !== -1 || d.indexOf(h) !== -1) return true;
  return false;
}

function stripAllLinksFromHtml(html, resourceDocUrl) {
  if (!html || typeof html !== "string") return html;
  var out = html.replace(/<a\b[^>]*\bhref\s*=\s*["'][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, "$1");
  out = out.replace(/<img\b[^>]*>/gi, "");
  if (resourceDocUrl) {
    var u = String(resourceDocUrl).trim();
    while (out.indexOf(u) !== -1) out = out.split(u).join(" ");
    try {
      var uDec = decodeURIComponent(u);
      while (out.indexOf(uDec) !== -1) out = out.split(uDec).join(" ");
    } catch (e) {}
  }
  out = out.replace(/https?:\/\/[^\s"'<>]*(?:airtable\.com|airtableusercontent\.com|dl\.airtable\.com)[^\s"'<>]*/gi, " ");
  out = out.replace(/https?:\/\/[^\s"'<>]+\.(docx?|xlsx?|ppt|pptx)(\?[^\s"'<>]*)?/gi, " ");
  return out;
}

function stripDocumentLinksFromHtml(html, resourceDocUrl) {
  if (!html || typeof html !== "string") return html;
  var out = html;
  function shouldStrip(href) {
    return isDocumentUrl(href) || (resourceDocUrl && hrefMatchesResourceDocUrl(href, resourceDocUrl));
  }
  out = out.replace(/<a\b[^>]*\bhref\s*=\s*(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi, function (full, _q, href, content) {
    return shouldStrip(href) ? content : full;
  });
  out = out.replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, function (full, href, content) {
    return shouldStrip(href) ? content : full;
  });
  out = out.replace(/https?:\/\/[^\s"'<>]+\.(docx?|xlsx?|ppt|pptx)(\?[^\s"'<>]*)?/gi, " ");
  if (resourceDocUrl) {
    var u = String(resourceDocUrl);
    while (out.indexOf(u) !== -1) out = out.split(u).join(" ");
    try {
      var uDec = decodeURIComponent(u);
      while (out.indexOf(uDec) !== -1) out = out.split(uDec).join(" ");
    } catch (e) {}
  }
  return out;
}

function stripDocumentLinksFromRaw(rawStr, resourceDocUrl) {
  if (!rawStr || typeof rawStr !== "string") return rawStr;
  return rawStr.replace(/\[([^\]]*)\]\((https?:[^)]+)\)/g, function (full, text, url) {
    if (isDocumentUrl(url)) return text;
    if (resourceDocUrl && hrefMatchesResourceDocUrl(url, resourceDocUrl)) return text;
    return full;
  });
}

function descriptionToPlainText(desc) {
  if (desc == null) return "";
  var s;
  if (typeof desc === "string") {
    s = desc.trim();
  } else if (typeof desc === "object" && desc !== null) {
    var o = desc;
    s = String(o.html ?? o.HTML ?? o.value ?? o.text ?? o.plain ?? o.content ?? "").trim();
    if (!s && Array.isArray(o.blocks)) {
      s = o.blocks.map(function (b) { return b.text ?? b.content ?? ""; }).join("\n").trim();
    }
  } else {
    s = String(desc).trim();
  }
  s = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function renderDescription(desc, fullWidth, options) {
  if (desc == null) return null;
  if (options && options.plainTextOnly) {
    var text = descriptionToPlainText(desc);
    if (text === "") return null;
    return (
      <div className={cn("leading-relaxed text-black/90", fullWidth ? "prose prose-sm max-w-none" : "prose prose-sm max-w-none")} style={{ lineHeight: 1.6 }}>
        {text}
      </div>
    );
  }
  var s;
  var fromBlocks = false;
  if (typeof desc === "string") {
    s = desc.trim();
  } else if (typeof desc === "object" && desc !== null) {
    var o = desc;
    var contentVal = o.html ?? o.HTML ?? o.value ?? o.text ?? o.plain;
    if (contentVal != null && typeof contentVal === "string") s = contentVal.trim();
    else if (Array.isArray(o.content) && o.content.length > 0) { s = blocksToHtml(o.content); fromBlocks = true; }
    else if (o.content != null && typeof o.content === "string") s = String(o.content).trim();
    else s = "";
    if (!s && Array.isArray(o.blocks) && o.blocks.length > 0) {
      s = blocksToHtml(o.blocks);
      fromBlocks = true;
    } else if (!s && Array.isArray(o.blocks)) {
      s = o.blocks.map(function (b) { return b.text ?? b.content ?? ""; }).join("\n").trim();
    } else if (!s && Array.isArray(o.elements) && o.elements.length > 0) {
      s = blocksToHtml(o.elements);
      fromBlocks = true;
    }
  } else {
    s = String(desc).trim();
  }
  if (s === "" && !fromBlocks) return null;
  if (s === "" && fromBlocks) return null;
  var resourceDocUrl = options && options.stripDocumentLinks ? (options.docUrl || null) : null;
  var stripAllLinks = options && options.stripAllLinks;
  if (!fromBlocks && options && options.stripDocumentLinks) s = stripDocumentLinksFromRaw(s, resourceDocUrl);
  var looksLikeMarkdown = typeof s === "string" && (/\*\*[^*]*\*\*|\[[^\]]+\]\([^)]+\)/.test(s) || /^\s*[-*]\s+/m.test(s));
  var isHtml = fromBlocks || (!looksLikeMarkdown && /<[a-z][\s\S]*>/i.test(s));
  var html = (looksLikeMarkdown && !fromBlocks) ? markdownToHtml(s) : (isHtml ? s : markdownToHtml(s));
  if (stripAllLinks) html = stripAllLinksFromHtml(html, options && options.docUrl ? options.docUrl : null);
  else if (options && options.stripDocumentLinks) html = stripDocumentLinksFromHtml(html, resourceDocUrl);
  return (
    <div
      className={cn("leading-relaxed text-black/90 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:!pl-12 [&_ol]:!pl-12 [&_ul]:!list-outside [&_ol]:!list-outside [&_li]:list-item [&_a]:!underline", fullWidth ? "" : "")}
      style={{ lineHeight: 1.6 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function collectAllUrls(val, out) {
  if (!out) out = [];
  if (val == null) return out;
  if (typeof val === "string" && val.trim()) {
    if (/^https?:\/\//i.test(val.trim())) out.push(val.trim());
    return out;
  }
  if (Array.isArray(val)) {
    for (var i = 0; i < val.length; i++) collectAllUrls(val[i], out);
    return out;
  }
  if (typeof val === "object") {
    if (val.url && typeof val.url === "string" && val.url.trim()) out.push(val.url.trim());
    for (var k in val) { if (Object.prototype.hasOwnProperty.call(val, k)) collectAllUrls(val[k], out); }
  }
  return out;
}

function collectAllAttachments(val, out) {
  if (!out) out = [];
  if (val == null) return out;
  if (Array.isArray(val)) {
    for (var i = 0; i < val.length; i++) {
      var a = val[i];
      if (a && typeof a === "object" && a.url && typeof a.url === "string" && a.url.trim()) {
        var name = (a.filename || a.name || a.title || "").trim() || "Attachment";
        out.push({ url: a.url.trim(), name: name });
      } else if (typeof a === "string" && a.trim() && /^https?:\/\//i.test(a.trim())) {
        out.push({ url: a.trim(), name: "Attachment" });
      }
    }
    return out;
  }
  if (typeof val === "object" && val.url && typeof val.url === "string" && val.url.trim()) {
    var n = (val.filename || val.name || val.title || "").trim() || "Attachment";
    out.push({ url: val.url.trim(), name: n });
    return out;
  }
  if (typeof val === "object") {
    for (var k in val) { if (Object.prototype.hasOwnProperty.call(val, k)) collectAllAttachments(val[k], out); }
  }
  return out;
}

function dedupeAttachmentsByUrl(arr) {
  var seen = {};
  return arr.filter(function (a) {
    var u = a && a.url;
    if (!u || seen[u]) return false;
    seen[u] = true;
    return true;
  });
}

function getVideoPreviewUrl(link) {
  if (!link || typeof link !== "string") return null;
  var m = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]{11})/i);
  if (m && m[1]) return "https://img.youtube.com/vi/" + m[1] + "/maxresdefault.jpg";
  return null;
}

function normalizeResourceType(rawType) {
  var val = rawType;
  if (val != null && typeof val === "object") {
    val = val.name ?? val.value ?? val.label ?? (Array.isArray(val) ? val[0] : null);
  }
  var t = String(val ?? "").trim();
  if (!t) return "External Link";
  var lower = t.toLowerCase();
  if (lower === "text") return "Text";
  if (lower === "contact") return "Contact";
  if (lower === "video") return "Video";
  if (lower === "pdf") return "PDF";
  if (lower === "image") return "Image";
  if (lower === "word/excel file" || lower === "word/excel" || lower === "document" || lower === "word document" || lower === "excel document" || (lower.indexOf("word") !== -1 && lower.indexOf("excel") !== -1)) return "Word/Excel File";
  if (lower === "word" || lower === "excel") return "Word/Excel File";
  if (lower === "checklist" || lower === "template" || lower.indexOf("checklist") !== -1 || lower.indexOf("template") !== -1) return "Word/Excel File";
  if (lower === "external link" || lower === "external") return "External Link";
  if (lower === "submission link" || lower === "submission") return "Submission Link";
  if (lower === "backstage site link" || lower === "backstage site" || lower.indexOf("backstage") !== -1) return "Backstage Site Link";
  if (lower === "recording") return "Recording";
  if (lower === "webinar rsvp" || lower === "webinar") return "Webinar RSVP";
  if (lower === "text + photo" || lower === "text+photo" || (lower.indexOf("text") !== -1 && lower.indexOf("photo") !== -1)) return "Text + Photo";
  return t;
}

function getRawType(raw) {
  var v = raw["Resource Type"] ?? raw.type ?? raw.ResourceType ?? raw.resourceType;
  if (v != null && typeof v === "string" && v.trim()) return v;
  if (v != null && typeof v === "object") return v;
  for (var key in raw) {
    if (key.toLowerCase().indexOf("type") !== -1 && key.toLowerCase().indexOf("resource") !== -1) {
      var x = raw[key];
      if (x != null && (typeof x === "string" || typeof x === "object")) return x;
    }
  }
  for (var key in raw) {
    if (key.toLowerCase().indexOf("type") !== -1) {
      var x = raw[key];
      if (x != null && (typeof x === "string" || typeof x === "object")) return x;
    }
  }
  return null;
}

function recordToResource(rec, orderId) {
  const raw = rec.fields || {};
  const title = stripYearSuffix(getResourceTitle(raw, {}));
  const type = normalizeResourceType(getRawType(raw));
  var link = typeof raw.link === "string" ? raw.link : typeof raw["Resource Link"] === "string" ? raw["Resource Link"] : null;
  if (!link) {
    var linkLike = raw["Backstage Link"] ?? raw.backstageLink ?? raw["Site Link"] ?? raw.siteLink ?? raw["URL"] ?? raw.url ?? raw["Link"];
    if (typeof linkLike === "string" && linkLike.trim()) link = linkLike.trim();
    else if (!link) for (var lk in raw) { if (lk.toLowerCase().indexOf("link") !== -1 || lk.toLowerCase().indexOf("url") === 0) { var v = raw[lk]; if (typeof v === "string" && v.trim()) { link = v.trim(); break; } } }
  }
  const description = raw["Resource Description"] ?? raw.description ?? raw["Description"] ?? raw.ResourceDescription ?? raw.resourceDescription ?? null;
  var photoArr = Array.isArray(raw["Resource Photo"]) ? raw["Resource Photo"] : Array.isArray(raw.photo) ? raw.photo : [];
  if (photoArr.length === 0) {
    var altPhoto = raw["Photo"] ?? raw["Profile Photo"] ?? raw.profilePhoto ?? raw["Avatar"] ?? raw.avatar ?? raw["Contact Photo"] ?? raw.contactPhoto ?? raw["Image"];
    if (Array.isArray(altPhoto) && altPhoto[0] && altPhoto[0].url) photoArr = altPhoto;
    else if (altPhoto && typeof altPhoto === "object" && altPhoto.url) photoArr = [altPhoto];
    else for (var pk in raw) { if (pk.toLowerCase().indexOf("photo") !== -1 || pk.toLowerCase().indexOf("avatar") !== -1 || pk.toLowerCase().indexOf("image") !== -1) { var pv = raw[pk]; if (Array.isArray(pv) && pv[0] && pv[0].url) { photoArr = pv; break; } if (pv && typeof pv === "object" && pv.url) { photoArr = [pv]; break; } } }
  }
  const photoUrl = photoArr[0] && photoArr[0].url ? photoArr[0].url : null;
  var rawDoc = raw["Resource Documentation"] ?? raw.documentation;
  var docArr = Array.isArray(rawDoc) ? rawDoc : (rawDoc && typeof rawDoc === "object" ? Object.values(rawDoc) : []);
  var docFlat = docArr.flat();
  function toDocItem(a) {
    if (!a) return null;
    if (typeof a === "string" && a.trim()) return { url: a.trim() };
    if (a.url) return { url: a.url };
    return null;
  }
  const docAttachments = docFlat.map(toDocItem).filter(Boolean);
  const docUrl = docAttachments[0] && docAttachments[0].url ? docAttachments[0].url : null;
  var surveyLink = typeof raw.surveyLink === "string" ? raw.surveyLink : typeof raw["Survey Link"] === "string" ? raw["Survey Link"] : null;
  if (!surveyLink && raw && typeof raw === "object") {
    for (var sk in raw) {
      if ((sk.toLowerCase().indexOf("survey") !== -1 || sk === "Survey Link") && typeof raw[sk] === "string" && raw[sk].trim()) {
        surveyLink = raw[sk].trim();
        break;
      }
    }
  }
  const dateVal = raw.date != null ? raw.date : null;
  const id = rec.id || raw.recordId || raw.RecordID || orderId;
  return { id: String(id), title, type, link, description, photoUrl, docUrl, docAttachments, rawDocumentation: rawDoc, rawFields: raw, surveyLink, dateVal };
}

export default function Block() {
  const params = useMemo(getParamsFromUrl, []);
  const sectionId = params.recordId;
  const courseId = params.courseId;
  const trackId = params.trackId;
  const sectionIds = params.sectionIds || [];
  const resourceIds = params.resourceIds || [];
  const personId = params.personId;

  const { data: resourcesData, status: resourcesStatus } = useRecords({
    select: resourcesSelect,
    where: resourceIds.length > 0 ? q.text("recordId").isOneOf(resourceIds) : undefined,
    count: 100,
  });

  const fetchedPages = (resourcesData && resourcesData.pages) ? resourcesData.pages : [];
  const fetchedItems = [];
  for (let i = 0; i < fetchedPages.length; i++) {
    const items = fetchedPages[i].items || [];
    for (let j = 0; j < items.length; j++) fetchedItems.push(items[j]);
  }

  const fetchedById = {};
  for (let i = 0; i < fetchedItems.length; i++) {
    const rec = fetchedItems[i];
    const rid = rec.id || (rec.fields && (rec.fields.recordId || rec.fields.RecordID));
    if (rid) fetchedById[String(rid)] = rec;
    if (rec.id) fetchedById[String(rec.id)] = rec;
  }

  const resourcesInOrder = resourceIds.map(function (rid, idx) {
    const rec = fetchedById[String(rid)];
    if (!rec) return null;
    return recordToResource(rec, rid);
  }).filter(Boolean);

  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const resourcesFiltered = resourcesInOrder.filter(function (r) {
    if (r.type !== "Webinar RSVP") return true;
    if (r.dateVal == null) return true;
    var d = new Date(String(r.dateVal));
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= todayStart.getTime();
  });

  const hasAny = resourcesFiltered.length > 0;
  const showNav = sectionIds.length > 1;
  const currentIndex = sectionId && sectionIds.length > 0 ? sectionIds.indexOf(sectionId) : -1;
  const prevId = currentIndex > 0 ? sectionIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < sectionIds.length - 1 ? sectionIds[currentIndex + 1] : null;

  const [surveyModalUrl, setSurveyModalUrl] = useState(null);
  const docUrlByResourceId = useRef({});

  function goToSection(id) {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    p.set("recordId", id);
    if (courseId) p.set("courseId", courseId);
    if (trackId) p.set("trackId", trackId);
    if (sectionIds.length > 0) p.set("sectionIds", sectionIds.join(","));
    if (personId) p.set("personId", personId);
    window.location.href = window.location.pathname + "?" + p.toString();
  }

  if (resourceIds.length === 0) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 lg:px-8 pb-8">
        <div className="w-full max-w-[1600px] mx-auto" />
      </div>
    );
  }

  if (resourcesStatus === "pending") {
    return (
      <div className="w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[200px]">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-3" />
        <p className="text-muted-foreground text-sm">Loading resources...</p>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="w-full max-w-full px-4 md:px-6 lg:px-8 pb-8">
        <div className="w-full max-w-[1600px] mx-auto" />
      </div>
    );
  }

  function safePhotoUrl(rec) {
    var url = rec.photoUrl;
    if (!url || typeof url !== "string") return null;
    if (rec.docUrl && (url === rec.docUrl || hrefMatchesResourceDocUrl(url, rec.docUrl))) return null;
    var u = String(url).split("?")[0].split("#")[0];
    if (/\.(doc|docx|xls|xlsx|ppt|pptx|pdf)(\?|#|$)/i.test(u)) return null;
    return url;
  }

  function DocPreviewArea({ type, photoUrl, title, docUrl }) {
    var containerClass = "flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden w-full";
    if (type === "PDF" && docUrl) {
      var pdfSrc = docUrl.indexOf("#") >= 0 ? docUrl + "&toolbar=0" : docUrl + "#toolbar=0";
      return (
        <div className={containerClass}>
          <iframe src={pdfSrc} title={title || "PDF preview"} className="w-full h-full min-h-[280px] border-0 rounded-t-lg" />
        </div>
      );
    }
    if (type === "PDF") {
      return (
        <div className="flex items-center justify-center aspect-video bg-muted/40 rounded-t-lg min-h-[140px] border-b border-border/50">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="rounded-lg bg-muted/80 p-4 flex items-center justify-center">
              <FileText className="h-14 w-14" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-medium">PDF</span>
            <span className="text-xs opacity-80">Open via button below</span>
          </div>
        </div>
      );
    }
    if (type === "Image" && photoUrl && !isDocumentUrl(photoUrl)) {
      return (
        <div className={containerClass}>
          <img src={photoUrl} alt={title} className="max-w-full max-h-full w-auto h-auto object-contain" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center aspect-video bg-muted/60 rounded-t-lg min-h-[140px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {type === "PDF" ? <FileText className="h-12 w-12" /> : type === "Word/Excel File" ? <FileText className="h-12 w-12" /> : <ImageIcon className="h-12 w-12" />}
          <span className="text-sm font-medium">{type === "PDF" ? "PDF" : type === "Word/Excel File" ? "Document" : "Preview"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 md:px-6 lg:px-8 pt-0 pb-8 md:pb-12">
      <div className="w-full max-w-[1600px] mx-auto">
        <Card className="mb-8 border-0 shadow-none bg-transparent">
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
              {resourcesFiltered.map(function (r) {
                if (!r) return null;
                var isFullWidth = ["Text", "Recording"].indexOf(r.type) !== -1;
                var isHalfWidth = r.type === "Text + Photo";
                var colClass = isFullWidth ? "md:col-span-6" : isHalfWidth ? "md:col-span-3" : "md:col-span-2";

                if (r.type === "Text") {
                  var textPhoto = safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {textPhoto && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          <img src={textPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        </div>
                      )}
                      <div className="p-6 flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-3">{r.title}</h3>
                        {renderDescription(r.description, true)}
                      </div>
                    </div>
                  );
                }

                if (r.type === "Text + Photo") {
                  var textPlusPhoto = (r.photoUrl && typeof r.photoUrl === "string") ? r.photoUrl : safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {textPlusPhoto && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[180px] overflow-hidden">
                          <img src={textPlusPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        </div>
                      )}
                      <div className="p-6 flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-3">{r.title}</h3>
                        {renderDescription(r.description, true)}
                      </div>
                    </div>
                  );
                }

                if (r.type === "Contact") {
                  var contactImgSrc = safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      <div className="p-6 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-muted/40 flex items-center justify-center mb-4 shrink-0 ring-2 ring-border flex-shrink-0">
                          {contactImgSrc ? (
                            <img src={contactImgSrc} alt={r.title} className="w-full h-full object-cover min-w-full min-h-full" />
                          ) : (
                            <span className="text-2xl font-semibold text-muted-foreground">{r.title ? r.title.charAt(0).toUpperCase() : "?"}</span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false)}
                      </div>
                    </div>
                  );
                }

                if (r.type === "Video") {
                  var videoThumb = getVideoPreviewUrl(r.link) || safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {videoThumb && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          {r.link ? (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full">
                              <img src={videoThumb} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                            </a>
                          ) : (
                            <img src={videoThumb} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                          )}
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false)}
                        {r.link && (
                          <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
                            <a href={r.link} target="_blank" rel="noopener noreferrer">Watch <ArrowRight className="ml-1 h-4 w-4 inline" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                var isWordExcelDoc = (r.type === "Word/Excel File" || (r.docUrl && isDocumentUrl(r.docUrl))) && r.type !== "PDF" && r.type !== "Image";
                if (isWordExcelDoc && r.docUrl) {
                  docUrlByResourceId.current[r.id] = r.docUrl;
                  var wordExcelPhoto = safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {wordExcelPhoto ? (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          <img src={wordExcelPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center aspect-video bg-muted/40 rounded-t-lg min-h-[140px] border-b border-border/50">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <div className="rounded-lg bg-muted/80 p-4 flex items-center justify-center">
                              <FileText className="h-14 w-14" strokeWidth={1.5} />
                            </div>
                            <span className="text-sm font-medium">Word / Excel</span>
                          </div>
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false, { plainTextOnly: true })}
                        <Button type="button" variant="outline" size="sm" className="mt-3 w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (window && u) window.open(u, "_blank", "noopener,noreferrer"); }}><Download className="mr-2 h-4 w-4" />Download File</Button>
                      </div>
                    </div>
                  );
                }

                if (r.type === "PDF" || r.type === "Image") {
                  if (r.docUrl) docUrlByResourceId.current[r.id] = r.docUrl;
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      <DocPreviewArea type={r.type} photoUrl={safePhotoUrl(r)} title={r.title} docUrl={r.type === "PDF" ? r.docUrl : null} />
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false, { stripDocumentLinks: true, docUrl: r.docUrl || undefined })}
                        {r.docUrl && r.type === "PDF" && (
                          <Button type="button" variant="outline" size="sm" className="mt-3 w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (typeof window !== "undefined" && u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                            <Download className="mr-2 h-4 w-4" />Download
                          </Button>
                        )}
                        {r.docUrl && r.type === "Image" && (
                          <Button type="button" variant="outline" size="sm" className="mt-3 w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (typeof window !== "undefined" && u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                            <Download className="mr-2 h-4 w-4" />Download
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (r.type === "External Link") {
                  var extPhoto = safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {extPhoto && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          <img src={extPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false)}
                        {r.link && (
                          <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
                            <a href={r.link} target="_blank" rel="noopener noreferrer">Go <ArrowRight className="ml-1 h-4 w-4 inline" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (r.type === "Submission Link") {
                  var subPhoto = (r.photoUrl && typeof r.photoUrl === "string") ? r.photoUrl : safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                        {subPhoto ? (
                          <img src={subPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <ImageIcon className="h-12 w-12" />
                            <span className="text-xs">Resource Photo</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false)}
                        <Button type="button" variant="outline" size="sm" className="mt-3 w-fit" onClick={function () { var u = r.surveyLink || r.link; if (u) setSurveyModalUrl(u); }}>
                          Go <ArrowRight className="ml-1 h-4 w-4 inline" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (r.type === "Backstage Site Link") {
                  var backstageHref = r.link || r.docUrl;
                  var backstageIsDoc = backstageHref && isDocumentUrl(backstageHref);
                  var backstageIsAttachment = backstageHref === r.docUrl;
                  if ((backstageIsDoc || backstageIsAttachment) && backstageHref) docUrlByResourceId.current[r.id] = backstageHref;
                  var backstagePhoto = (r.photoUrl && typeof r.photoUrl === "string") ? r.photoUrl : safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden w-full">
                        {backstagePhoto ? (
                          <img src={backstagePhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground min-h-[140px] w-full">
                            <ImageIcon className="h-12 w-12 shrink-0" />
                            <span className="text-xs">Resource Photo</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                        {renderDescription(r.description, false, (backstageIsDoc || backstageIsAttachment) ? { stripDocumentLinks: true, docUrl: backstageHref || undefined } : undefined)}
                        {backstageHref && (backstageIsDoc || backstageIsAttachment ? (
                          <Button type="button" variant="outline" size="sm" className="mt-3 w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (typeof window !== "undefined" && u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                            Go <ArrowRight className="ml-1 h-4 w-4 inline" />
                          </Button>
                        ) : (
                          <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
                            <a href={backstageHref} target="_blank" rel="noopener noreferrer">Go <ArrowRight className="ml-1 h-4 w-4 inline" /></a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (r.type === "Recording") {
                  var recPhoto = safePhotoUrl(r);
                  var raw = r.rawFields || {};
                  var rawDoc = raw["Resource Documentation"] ?? raw.documentation ?? r.rawDocumentation;
                  if (rawDoc == null && typeof raw === "object") {
                    for (var _dk in raw) { if (_dk.toLowerCase().indexOf("documentation") !== -1) { rawDoc = raw[_dk]; break; } }
                  }
                  var recDocAttachments = dedupeAttachmentsByUrl(collectAllAttachments(rawDoc, []));
                  if (recDocAttachments.length === 0 && r.docAttachments && Array.isArray(r.docAttachments)) {
                    recDocAttachments = dedupeAttachmentsByUrl(r.docAttachments.map(function (a) {
                      return a && a.url ? { url: a.url, name: (a.filename || a.name || "Attachment") } : null;
                    }).filter(Boolean));
                  }
                  if (recDocAttachments.length === 0 && raw && typeof raw === "object") {
                    for (var _ak in raw) { if (_ak.toLowerCase().indexOf("attachment") !== -1 || _ak.toLowerCase().indexOf("document") !== -1) { recDocAttachments = dedupeAttachmentsByUrl(collectAllAttachments(raw[_ak], [])); if (recDocAttachments.length > 0) break; } }
                  }
                  var recDescription = r.description;
                  if ((recDescription == null || (typeof recDescription === "string" && !recDescription.trim())) && typeof raw === "object") {
                    for (var _dk in raw) { if (_dk.toLowerCase().indexOf("description") !== -1 && raw[_dk] != null) { recDescription = raw[_dk]; break; } }
                  }
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {recPhoto && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          {r.link ? (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full">
                              <img src={recPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                            </a>
                          ) : (
                            <img src={recPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                          )}
                        </div>
                      )}
                      <div className="p-6 flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-3">{r.title}</h3>
                        {renderDescription(recDescription, true)}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {r.link && (
                            <Button asChild variant="outline" size="sm" className="w-fit">
                              <a href={r.link} target="_blank" rel="noopener noreferrer">Watch <ArrowRight className="ml-1 h-4 w-4 inline" /></a>
                            </Button>
                          )}
                          {recDocAttachments.length > 0 && (
                            recDocAttachments.length === 1 ? (
                              <Button asChild variant="outline" size="sm" className="w-fit">
                                <a href={recDocAttachments[0].url} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download {recDocAttachments[0].name}</a>
                              </Button>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {recDocAttachments.map(function (att, idx) {
                                  return (
                                    <Button key={idx} asChild variant="outline" size="sm" className="w-fit">
                                      <a href={att.url} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download {att.name}</a>
                                    </Button>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (r.type === "Webinar RSVP") {
                  var webinarPhoto = safePhotoUrl(r);
                  return (
                    <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                      {webinarPhoto && (
                        <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                          {r.link ? (
                            <a href={r.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full h-full">
                              <img src={webinarPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                            </a>
                          ) : (
                            <img src={webinarPhoto} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                          )}
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" />
                          {r.title}
                        </h3>
                        {r.dateVal && <p className="text-sm text-muted-foreground mb-3">{new Date(String(r.dateVal)).toLocaleDateString()}</p>}
                        {renderDescription(r.description, false)}
                        {r.link && (
                          <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
                            <a href={r.link} target="_blank" rel="noopener noreferrer">Register <ArrowRight className="ml-1 h-4 w-4 inline" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                var fallbackLinkIsDoc = (r.link && isDocumentUrl(r.link)) || (r.docUrl && isDocumentUrl(r.docUrl));
                var fallbackDocUrl = fallbackLinkIsDoc ? (r.docUrl || r.link) : null;
                if (fallbackDocUrl) docUrlByResourceId.current[r.id] = fallbackDocUrl;
                var fallbackImg = fallbackLinkIsDoc ? safePhotoUrl(r) : (safePhotoUrl(r) || (r.link && getVideoPreviewUrl(r.link)));
                return (
                  <div key={r.id} className={cn("flex flex-col border border-border rounded-lg bg-card overflow-hidden shadow-sm h-auto", colClass)}>
                    {fallbackImg ? (
                      <div className="flex items-center justify-center aspect-video bg-muted/30 rounded-t-lg min-h-[140px] overflow-hidden">
                        <img src={fallbackImg} alt={r.title} className="max-w-full max-h-full w-auto h-auto object-contain" />
                      </div>
                    ) : fallbackLinkIsDoc ? (
                      <div className="flex items-center justify-center aspect-video bg-muted/40 rounded-t-lg min-h-[140px] border-b border-border/50">
                        <div className="flex items-center justify-center text-muted-foreground">
                          <FileText className="h-14 w-14" strokeWidth={1.5} />
                        </div>
                      </div>
                    ) : null}
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                      {renderDescription(r.description, false, fallbackLinkIsDoc ? { stripDocumentLinks: true, docUrl: fallbackDocUrl || undefined } : undefined)}
                      {(r.link || r.docUrl) && (fallbackLinkIsDoc ? (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (typeof window !== "undefined" && u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                            Preview
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={function () { var u = docUrlByResourceId.current[r.id]; if (typeof window !== "undefined" && u) window.open(u, "_blank", "noopener,noreferrer"); }}>
                            {r.docUrl ? "Download" : "Open"}
                          </Button>
                        </div>
                      ) : r.link ? (
                        <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
                          <a href={r.link} target="_blank" rel="noopener noreferrer">Open</a>
                        </Button>
                      ) : null)}
                    </div>
                  </div>
                );
              })}
            </div>
            {showNav && (
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-border/50 mt-6">
                <Button variant="outline" onClick={function () { if (prevId) goToSection(prevId); }} disabled={!prevId} className="flex-1">
                  <ChevronLeft className="mr-2 h-4 w-4" />Previous Page
                </Button>
                <span className="text-sm text-muted-foreground whitespace-nowrap">{currentIndex + 1} of {sectionIds.length}</span>
                <Button variant="outline" onClick={function () { if (nextId) goToSection(nextId); }} disabled={!nextId} className="flex-1">
                  Next Page<ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        {surveyModalUrl && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label="Survey" onClick={function (e) { if (e.target === e.currentTarget) setSurveyModalUrl(null); }}>
            <div className="relative w-full max-w-3xl flex flex-col rounded-lg bg-card border border-border shadow-xl overflow-hidden" style={{ minHeight: "70vh", maxHeight: "90vh" }} onClick={function (e) { e.stopPropagation(); }}>
              <div className="flex items-center justify-between shrink-0 p-2 border-b border-border bg-muted/30">
                <a href={surveyModalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">Open in new tab</a>
                <button type="button" onClick={function () { setSurveyModalUrl(null); }} className="p-2 rounded-md hover:bg-muted text-foreground" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 min-h-[60vh] relative bg-muted/20">
                <iframe src={surveyModalUrl} title="Survey" className="absolute inset-0 w-full h-full border-0 rounded-b-lg min-h-[60vh]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
