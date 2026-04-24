"use client";
/**
 * Page 4 – Section content (standalone app: props + /api/sections).
 */
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { buildTrackViewHref, resolveFinishTrackRecordId } from "@/lib/lms-track-nav";
import { ComprehensionCheckSection } from "@/components/lms/ComprehensionCheckSection";
import { getComprehensionChoicesRaw, getComprehensionQuestionMode, isSurveySectionFields } from "@/lib/lms-fields";

var SECTION_VIEW_WEBHOOK_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SECTION_VIEW_URL
    ? process.env.NEXT_PUBLIC_SECTION_VIEW_URL
    : "https://softr-learning-tracks-webhook-proxy.netlify.app/api/section-view";
var COMPLETE_API_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_COMPLETE_API_URL
    ? process.env.NEXT_PUBLIC_COMPLETE_API_URL
    : "https://softr-learning-tracks-webhook-proxy.netlify.app/api/complete";
/** Standalone single-section + resources (`recordId` = section id). */
var TRAINING_SESSION_PATH = "/training-session";
/** Course reader with TOC (`recordId` = course id). */
var COURSE_READER_PATH = "/section-detail";

/** Section title (largest red) > Airtable large heading h1; h2 red; h3 black. */
function lmsSectionTitleClass(embedInCourseDetail) {
  return embedInCourseDetail
    ? "text-4xl md:text-5xl font-bold tracking-tight text-[#E61C39] text-center"
    : "text-5xl md:text-6xl font-bold tracking-tight text-[#E61C39] text-center";
}

function lmsRichTextHeadingProse(embedInCourseDetail) {
  if (embedInCourseDetail) {
    return (
      "[&_h1]:!mt-4 [&_h1]:!mb-2 [&_h1]:!font-bold [&_h1]:!tracking-tight [&_h1]:!text-[#E61C39] [&_h1]:!text-3xl md:[&_h1]:!text-4xl " +
      "[&_h2]:!mt-3 [&_h2]:!mb-2 [&_h2]:!font-bold [&_h2]:!text-[#E61C39] [&_h2]:!text-xl md:[&_h2]:!text-2xl [&_h2]:!leading-tight " +
      "[&_h3]:!mt-3 [&_h3]:!mb-1.5 [&_h3]:!font-semibold [&_h3]:!text-black [&_h3]:!text-lg md:[&_h3]:!text-xl [&_h3]:!leading-snug " +
      "[&_h4]:!mt-2 [&_h4]:!mb-1 [&_h4]:!font-semibold [&_h4]:!text-[#E61C39] [&_h4]:!text-sm " +
      "[&_h5]:!mt-2 [&_h5]:!mb-1 [&_h5]:!font-semibold [&_h5]:!text-[#E61C39] [&_h5]:!text-xs " +
      "[&_h6]:!mt-2 [&_h6]:!mb-1 [&_h6]:!font-semibold [&_h6]:!text-[#E61C39] [&_h6]:!text-xs"
    );
  }
  return (
    "[&_h1]:!mt-4 [&_h1]:!mb-2 [&_h1]:!font-bold [&_h1]:!tracking-tight [&_h1]:!text-[#E61C39] [&_h1]:!text-4xl md:[&_h1]:!text-5xl " +
    "[&_h2]:!mt-3 [&_h2]:!mb-2 [&_h2]:!font-bold [&_h2]:!text-[#E61C39] [&_h2]:!text-2xl md:[&_h2]:!text-3xl [&_h2]:!leading-tight " +
    "[&_h3]:!mt-3 [&_h3]:!mb-1.5 [&_h3]:!font-semibold [&_h3]:!text-black [&_h3]:!text-xl md:[&_h3]:!text-2xl [&_h3]:!leading-snug " +
    "[&_h4]:!mt-2 [&_h4]:!mb-1 [&_h4]:!font-semibold [&_h4]:!text-[#E61C39] [&_h4]:!text-sm " +
    "[&_h5]:!mt-2 [&_h5]:!mb-1 [&_h5]:!font-semibold [&_h5]:!text-[#E61C39] [&_h5]:!text-xs " +
    "[&_h6]:!mt-2 [&_h6]:!mb-1 [&_h6]:!font-semibold [&_h6]:!text-[#E61C39] [&_h6]:!text-xs"
  );
}

/** Classes for markdown # / ## / ### lines (must match lmsRichTextHeadingProse ladder). */
function lmsAtxHeadingClass(embedInCourseDetail, depth) {
  var d = Math.min(6, Math.max(1, depth));
  if (embedInCourseDetail) {
    if (d === 1) return "font-bold tracking-tight text-[#E61C39] text-3xl md:text-4xl mt-4 mb-2 leading-tight";
    if (d === 2) return "font-bold text-[#E61C39] text-xl md:text-2xl mt-3 mb-2 leading-tight";
    if (d === 3) return "font-semibold text-black text-lg md:text-xl mt-3 mb-1.5 leading-snug";
    return "font-semibold text-[#E61C39] text-sm mt-2 mb-1 leading-snug";
  }
  if (d === 1) return "font-bold tracking-tight text-[#E61C39] text-4xl md:text-5xl mt-4 mb-2 leading-tight";
  if (d === 2) return "font-bold text-[#E61C39] text-2xl md:text-3xl mt-3 mb-2 leading-tight";
  if (d === 3) return "font-semibold text-black text-xl md:text-2xl mt-3 mb-1.5 leading-snug";
  return "font-semibold text-[#E61C39] text-sm mt-2 mb-1 leading-snug";
}

function sanitizeRichTextHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Markdown-style ATX heading on a line (after bold/link transforms). Returns full <hN>… or null. */
function markdownLineAsHeadingOrNull(trimmedLine, embedInCourseDetail) {
  if (!trimmedLine) return null;
  var m = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
  if (!m) return null;
  var depth = Math.min(6, Math.max(1, m[1].length));
  var inner = m[2];
  var cls = lmsAtxHeadingClass(Boolean(embedInCourseDetail), depth);
  return "<h" + depth + " class=\"" + cls + "\">" + inner + "</h" + depth + ">";
}

function recordSectionView(personId, courseId, sectionIds, viewedSectionId) {
  if (typeof window === "undefined" || !personId || !courseId || !viewedSectionId) return;
  var ids = sectionIds && sectionIds.length > 0 ? sectionIds.slice() : [viewedSectionId];
  var idx = ids.indexOf(viewedSectionId);
  if (idx === -1) idx = 0;
  var debug = typeof window !== "undefined" && window.location && window.location.search && window.location.search.indexOf("debug=1") !== -1;
  if (SECTION_VIEW_WEBHOOK_URL && typeof fetch !== "undefined") {
    try {
      var payload = {
        personId: personId,
        sectionId: viewedSectionId,
        courseId: courseId,
        viewedAt: new Date().toISOString(),
        lastViewedIndex: idx,
        personnelRecordIds: [personId],
        contactRecordIds: [personId],
        sectionRecordIds: [viewedSectionId],
        courseRecordIds: [courseId]
      };
      if (debug) console.warn("[Section View] Sending webhook to Airtable", payload);
      fetch(SECTION_VIEW_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (debug) console.warn("[Section View] Webhook response", res.status, res.statusText);
          return res.text();
        })
        .then(function (text) { if (debug && text) console.warn("[Section View] Body", text); })
        .catch(function (err) { if (debug) console.warn("[Section View] Webhook error", err); });
    } catch (e) { if (debug) console.warn("[Section View] Webhook exception", e); }
  }
}

function recordCourseComplete(personId, courseId) {
  if (typeof window === "undefined" || !personId || !courseId || !COMPLETE_API_URL || typeof fetch === "undefined") return;
  try {
    fetch(COMPLETE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: personId, courseId: courseId })
    }).catch(function () {});
  } catch (e) {}
}

function markdownToHtml(md, embedInCourseDetail) {
  if (!md || typeof md !== "string") return "";
  var embed = Boolean(embedInCourseDetail);
  var out = md;
  out = out.replace(/\\_/g, "_").replace(/\\\*/g, "*");
  var linkUrls = [];
  out = out.replace(/<(https?:\/\/[^>\s]+)>/gi, function (m, url) {
    linkUrls.push(url);
    return "\u0001L" + (linkUrls.length - 1) + "L\u0001";
  });
  out = out.replace(/(^|\s)(https?:\/\/[^\s<>)\]]+)/gi, function (m, before, url) {
    if (!url || /^https?:\/\/$/i.test(url)) return m;
    linkUrls.push(url);
    return before + "\u0001L" + (linkUrls.length - 1) + "L\u0001";
  });
  out = out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/\u0001L(\d+)L\u0001/g, function (m, idx) {
    var url = linkUrls[Number(idx)];
    var safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return "<a href=\"" + safe + "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"text-decoration:underline\">" + url.replace(/&/g, "&amp;") + "</a>";
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
  function listOpenTag(tag) {
    return tag === "ol"
      ? "<ol style=\"list-style-type:decimal;padding-left:2.5rem;margin:0.35rem 0 0.5rem 0;list-style-position:outside\">"
      : "<ul style=\"list-style-type:disc;padding-left:2.5rem;margin:0.35rem 0 0.5rem 0;list-style-position:outside\">";
  }
  function closeListAtDepth(depth) {
    if (depth < 0 || depth >= listStack.length) return;
    if (listStack[depth].liOpen) {
      result.push("</li>");
      listStack[depth].liOpen = false;
    }
    result.push("</" + listStack[depth].tag + ">");
    listStack.pop();
  }
  function closeAllLists() {
    while (listStack.length > 0) closeListAtDepth(listStack.length - 1);
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    var numberedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (bulletMatch || numberedMatch) {
      var match = bulletMatch || numberedMatch;
      var tag = bulletMatch ? "ul" : "ol";
      var indentRaw = (match[1] || "").replace(/\t/g, "    ");
      var level = Math.floor(indentRaw.length / 2);
      if (level < 0) level = 0;

      if (listStack.length === 0) {
        result.push(listOpenTag(tag));
        listStack.push({ tag: tag, liOpen: false });
      }

      while (listStack.length - 1 > level) closeListAtDepth(listStack.length - 1);

      while (listStack.length - 1 < level) {
        var parent = listStack[listStack.length - 1];
        if (!parent.liOpen) {
          result.push("<li class=\"leading-relaxed\" style=\"list-style-type:none;margin:0;padding:0\">");
          parent.liOpen = true;
        }
        var nestedTag = listStack.length - 1 + 1 === level ? tag : parent.tag;
        result.push(listOpenTag(nestedTag));
        listStack.push({ tag: nestedTag, liOpen: false });
      }

      var active = listStack[listStack.length - 1];
      if (active.tag !== tag) {
        closeListAtDepth(listStack.length - 1);
        if (listStack.length > 0) {
          var p = listStack[listStack.length - 1];
          if (!p.liOpen) {
            result.push("<li class=\"leading-relaxed\" style=\"list-style-type:none;margin:0;padding:0\">");
            p.liOpen = true;
          }
        }
        result.push(listOpenTag(tag));
        listStack.push({ tag: tag, liOpen: false });
        active = listStack[listStack.length - 1];
      }

      if (active.liOpen) {
        result.push("</li>");
        active.liOpen = false;
      }
      var itemContent = String(match[2] || "").trim();
      result.push("<li class=\"leading-relaxed\">" + itemContent);
      active.liOpen = true;
    } else {
      closeAllLists();
      var t = line.trim();
      var headingHtml = markdownLineAsHeadingOrNull(t, embed);
      if (headingHtml) result.push(headingHtml);
      else result.push(t === "" ? "<p style=\"margin:0.15rem 0\">&nbsp;</p>" : "<p style=\"margin:0.35rem 0 0.5rem 0;line-height:1.6\">" + t + "</p>");
    }
  }
  closeAllLists();
  return result.join("\n");
}

function getVideoEmbedUrl(url) {
  if (!url || typeof url !== "string") return null;
  var u = url.trim();
  var v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v && v[1]) return "https://player.vimeo.com/video/" + v[1] + "?title=0&byline=0&portrait=0&dnt=1";
  var yShort = u.match(/youtube\.com\/shorts\/([^/?&]{11})/i);
  if (yShort && yShort[1]) return "https://www.youtube-nocookie.com/embed/" + yShort[1] + "?modestbranding=1&rel=0";
  var yWatch = u.match(/(?:youtube\.com\/watch\?.*[?&]v=|youtube\.com\/embed\/|youtu\.be\/)([^"&?/ ]{11})/i);
  if (yWatch && yWatch[1]) return "https://www.youtube-nocookie.com/embed/" + yWatch[1] + "?modestbranding=1&rel=0";
  var yLegacy = u.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i);
  if (yLegacy && yLegacy[1]) return "https://www.youtube-nocookie.com/embed/" + yLegacy[1] + "?modestbranding=1&rel=0";
  return null;
}

function parseChecklistToTree(body) {
  if (!body || typeof body !== "string") return [];
  var str = body.trim();
  if (!str) return [];
  var isHtml = /<ul[\s>]|<ol[\s>]|<li[\s>]/i.test(str);
  var flat = [];
  if (isHtml && typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
      var div = document.createElement("div");
      div.innerHTML = str;
      var uls = div.querySelectorAll("ul, ol");
      if (uls.length > 0) {
        function fromList(listEl, depth) {
          var items = [];
          var lis = listEl.querySelectorAll(":scope > li");
          lis.forEach(function (li) {
            var childLists = li.querySelectorAll(":scope > ul, :scope > ol");
            var textParts = [];
            var walk = function (node) {
              if (node.nodeType === 3) textParts.push(node.textContent || "");
              if (node.nodeType === 1 && node.tagName !== "UL" && node.tagName !== "OL") {
                for (var j = 0; j < node.childNodes.length; j++) {
                  if (node.childNodes[j].tagName === "UL" || node.childNodes[j].tagName === "OL") return;
                  walk(node.childNodes[j]);
                }
              }
            };
            for (var i = 0; i < li.childNodes.length; i++) {
              if (li.childNodes[i].tagName === "UL" || li.childNodes[i].tagName === "OL") break;
              walk(li.childNodes[i]);
            }
            var text = textParts.join("").replace(/\s+/g, " ").trim();
            var children = [];
            childLists.forEach(function (cl) { children = children.concat(fromList(cl, depth + 1)); });
            items.push({ level: depth, text: text, children: children });
          });
          return items;
        }
        var topLevel = [];
        uls.forEach(function (ul) {
          if (ul.parentNode && ul.parentNode.tagName !== "LI") topLevel = topLevel.concat(fromList(ul, 0));
        });
        if (topLevel.length > 0) return topLevel;
      }
    } catch (e) {}
  }
  if (isHtml) str = str.replace(/<li[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\n\s+/g, "\n").trim();
  var lines = str.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var leading = line.match(/^[\s]*/)[0] || "";
    var spaces = leading.replace(/\t/g, "  ").length;
    var level = Math.min(Math.floor(spaces / 2), 6);
    var trim = line.trim();
    trim = trim.replace(/^\[\s*[xX]?\s*\]\s*/, "").replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (!trim) continue;
    flat.push({ level: level, text: trim });
  }
  var stack = [];
  var root = [];
  for (var k = 0; k < flat.length; k++) {
    var item = flat[k];
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) stack.pop();
    var obj = { text: item.text, children: [] };
    if (stack.length === 0) { root.push(obj); stack.push({ node: obj, level: item.level }); }
    else { stack[stack.length - 1].node.children.push(obj); stack.push({ node: obj, level: item.level }); }
  }
  return root;
}

function checklistToPrintHtml(nodes, state, pathPrefix) {
  if (!nodes || nodes.length === 0) return "";
  var html = "";
  for (var i = 0; i < nodes.length; i++) {
    var path = pathPrefix ? pathPrefix + "-" + i : String(i);
    var node = nodes[i];
    var text = (node.text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    var checked = state[path] ? " checked" : "";
    var indent = pathPrefix ? (path.split("-").length * 20) : 0;
    html += "<div style=\"display:flex;align-items:flex-start;gap:12px;padding:8px 0;" + (indent ? "padding-left:" + indent + "px;" : "") + "\">";
    html += "<input type=\"checkbox\" " + checked + " readonly style=\"margin-top:6px;width:18px;height:18px;flex-shrink:0\" />";
    html += "<span style=\"flex:1;line-height:1.6;color:#000\">" + text + "</span></div>";
    if (node.children && node.children.length > 0) html += checklistToPrintHtml(node.children, state, path);
  }
  return html;
}

function openChecklistPrintWindow(sectionTitle, checklistTree, checklistState) {
  if (typeof window === "undefined") return;
  var titleHtml = (sectionTitle || "Checklist").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  var bodyHtml = checklistToPrintHtml(checklistTree, checklistState, "");
  var doc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + titleHtml + "</title><style>body{font-family:system-ui,sans-serif;padding:24px 32px;max-width:800px;margin:0 auto;color:#000}h1{font-size:1.5rem;font-weight:700;color:#E61C39;margin:0 0 1rem 0}</style></head><body><h1>" + titleHtml + "</h1><div>" + bodyHtml + "</div><script>window.onload=function(){window.print();}</script></body></html>";
  try {
    var blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, "_blank", "noopener,noreferrer");
    if (w) setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  } catch (e) {
    var w = window.open("", "_blank", "noopener,noreferrer");
    if (w) { w.document.write(doc); w.document.close(); }
  }
}

export default function Block(props) {
  const sectionId = props.recordId;
  const courseId = props.courseId;
  const trackId = props.trackId;
  const sectionIds = props.sectionIds || [];
  const personId = props.personId;
  const getResourceIdsForSection = typeof props.getResourceIdsForSection === "function" ? props.getResourceIdsForSection : null;
  const onBackToOutline = typeof props.onBackToOutline === "function" ? props.onBackToOutline : null;
  const onNavigateEmbedSection = typeof props.onNavigateEmbedSection === "function" ? props.onNavigateEmbedSection : null;
  const embedInCourseDetail = Boolean(props.embedInCourseDetail);
  var linkedLearningTrackIds = Array.isArray(props.linkedLearningTrackIds)
    ? props.linkedLearningTrackIds.filter(function (x) { return typeof x === "string" && x.trim(); })
    : [];

  const [section, setSection] = useState(null);
  const [sectionStatus, setSectionStatus] = useState("pending");

  const [checklistState, setChecklistState] = useState({});
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [compQuizPassed, setCompQuizPassed] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  useEffect(function () { setGalleryIndex(0); }, [sectionId]);
  useEffect(function () { setCompQuizPassed(false); }, [sectionId]);
  useEffect(function () { setLightbox(null); }, [sectionId]);
  useEffect(function () {
    if (!lightbox) return;
    function onKey(e) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [lightbox]);

  useEffect(function () {
    if (!personId || !courseId || !sectionId || !section) return;
    var mode = getComprehensionQuestionMode(section.fields);
    var surveyRequired = isSurveySectionFields(section.fields);
    if (mode && Boolean(props.comprehensionPersistenceDisabled)) return;
    var hydrated = Boolean(props.comprehensionHydratedPass);
    if (mode && !hydrated && !compQuizPassed) return;
    if (surveyRequired && !Boolean(props.surveyHydratedPass)) return;
    recordSectionView(personId, courseId, sectionIds.length > 0 ? sectionIds : [sectionId], sectionId);
  }, [
    personId,
    courseId,
    sectionId,
    sectionIds.join(","),
    section,
    props.comprehensionHydratedPass,
    props.surveyHydratedPass,
    compQuizPassed,
    props.comprehensionPersistenceDisabled,
  ]);

  useEffect(function () {
    if (!sectionId) {
      setSection(null);
      setSectionStatus("success");
      return;
    }
    setSectionStatus("pending");
    fetch("/api/sections/" + encodeURIComponent(sectionId))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        setSection({ id: data.id, fields: data.fields });
        setSectionStatus("success");
      })
      .catch(function () {
        setSection(null);
        setSectionStatus("error");
      });
  }, [sectionId]);

  const fields = (section && section.fields) ? section.fields : {};
  function get() {
    for (var i = 0; i < arguments.length; i++) {
      var v = fields[arguments[i]];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }
  function getByPartial(sub) {
    for (var k in fields) {
      if (k.toLowerCase().indexOf(sub.toLowerCase()) !== -1) {
        var v = fields[k];
        if (v !== undefined && v !== null) return v;
      }
    }
    return undefined;
  }

  var bodyRaw = get("body", "Section Body") || getByPartial("body");
  var body = bodyRaw;
  if (body != null && typeof body === "object" && !Array.isArray(body)) body = body.html || body.HTML || body.value || body.text || body.plain || body.content || null;
  if (body != null && typeof body !== "string") body = String(body);

  var galleryRaw = get("gallery", "Gallery") || getByPartial("gallery");
  var galleryImages = [];
  if (Array.isArray(galleryRaw) && galleryRaw.length > 0) {
    for (var gi = 0; gi < galleryRaw.length; gi++) {
      var item = galleryRaw[gi];
      var imgUrl = typeof item === "string" ? item : (item && item.url) ? item.url : null;
      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim()) galleryImages.push({ url: imgUrl.trim(), name: (item && (item.filename || item.name)) ? String(item.filename || item.name) : "Image " + (gi + 1) });
    }
  } else if (galleryRaw && typeof galleryRaw === "object" && galleryRaw.url) {
    galleryImages.push({ url: String(galleryRaw.url).trim(), name: galleryRaw.filename || galleryRaw.name || "Image 1" });
  }

  var sectionTypeRaw = get("type", "Section Type") || getByPartial("section type");
  if (sectionTypeRaw != null && typeof sectionTypeRaw === "object" && !Array.isArray(sectionTypeRaw)) sectionTypeRaw = sectionTypeRaw.name || sectionTypeRaw.value || sectionTypeRaw.label;
  if (Array.isArray(sectionTypeRaw) && sectionTypeRaw.length > 0) sectionTypeRaw = sectionTypeRaw[0];
  if (sectionTypeRaw != null && typeof sectionTypeRaw === "object" && !Array.isArray(sectionTypeRaw)) sectionTypeRaw = sectionTypeRaw.name || sectionTypeRaw.value || sectionTypeRaw.label;
  var rawTypeLabel = String(sectionTypeRaw || "Text").trim();
  var sectionTypeLower = rawTypeLabel.toLowerCase();
  var sectionType = rawTypeLabel;
  if (sectionTypeLower === "video" || sectionTypeLower.indexOf("video") !== -1) sectionType = "Video";
  else if (sectionTypeLower === "survey" || sectionTypeLower === "submission" || sectionTypeLower === "submission link" || sectionTypeLower.indexOf("survey") !== -1 || sectionTypeLower.indexOf("submission") !== -1) sectionType = "Survey";
  else if (sectionTypeLower === "checklist") sectionType = "Checklist";
  else if (
    (sectionTypeLower.indexOf("photo") !== -1 || sectionTypeLower.indexOf("infographic") !== -1) &&
    sectionTypeLower.indexOf("gallery") === -1
  ) sectionType = "Text + Photo";
  else if (sectionTypeLower.indexOf("gallery") !== -1 || galleryImages.length > 0) sectionType = "Text + Gallery";
  else if (sectionTypeLower === "text + links" || sectionTypeLower === "text+links" || (sectionTypeLower.indexOf("text") !== -1 && sectionTypeLower.indexOf("link") !== -1)) sectionType = "Text + Links";
  else if (sectionTypeLower === "text") sectionType = "Text";

  var videoRaw = get("video", "Section Video") || getByPartial("video");
  var videoUrl;
  if (typeof videoRaw === "string") videoUrl = videoRaw;
  else if (Array.isArray(videoRaw) && videoRaw[0] && typeof videoRaw[0] === "object" && videoRaw[0].url) videoUrl = videoRaw[0].url;
  else if (videoRaw && videoRaw.url) videoUrl = videoRaw.url;
  else videoUrl = undefined;

  var surveyLinkRaw = get("surveyLink", "Survey Link") || get("Survey Link", "surveyLink") || getByPartial("survey") || getByPartial("form link") || getByPartial("form");
  function toSurveyUrl(val) {
    if (!val) return "";
    if (typeof val === "string" && val.trim()) return val.trim();
    if (val && typeof val === "object" && typeof val.url === "string" && val.url.trim()) return val.url.trim();
    if (Array.isArray(val) && val.length > 0) {
      var first = val[0];
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object" && typeof first.url === "string") return first.url.trim();
    }
    return "";
  }
  var surveyLink = toSurveyUrl(surveyLinkRaw);
  var isSurveyOrSubmission = sectionTypeLower.indexOf("survey") !== -1 || sectionTypeLower.indexOf("submission") !== -1;
  if (!surveyLink && isSurveyOrSubmission && typeof fields === "object") {
    for (var sk in fields) {
      var v = fields[sk];
      var u = toSurveyUrl(v);
      if (u && (/^https?:\/\//i.test(u) || u.indexOf("airtable.com") !== -1)) { surveyLink = u; break; }
    }
  }
  var sectionTitle = "Section";
  if (section && section.fields) {
    var f = section.fields;
    var exact = f["Section Title"] || getByPartial("section title");
    if (exact != null) sectionTitle = String(exact);
    else {
      for (var key in f) {
        if (key.toLowerCase().indexOf("section") !== -1 && key.toLowerCase().indexOf("title") !== -1 && f[key] != null && typeof f[key] === "string") {
          sectionTitle = String(f[key]);
          break;
        }
      }
      if (sectionTitle === "Section") sectionTitle = String(f.label || f.name || f.title || f["Title"] || "Section");
    }
    sectionTitle = sectionTitle.replace(/\s*-\s*20\d{2}\s*$/, "").trim() || sectionTitle;
  }

  var currentIndex = sectionId && sectionIds.length > 0 ? sectionIds.indexOf(sectionId) : -1;
  var prevId = currentIndex > 0 ? sectionIds[currentIndex - 1] : null;
  var nextId = currentIndex >= 0 && currentIndex < sectionIds.length - 1 ? sectionIds[currentIndex + 1] : null;
  // Prev/Next/Finish on section-detail; on embedded course reader the footer lives under Resource Library only.
  var showNav = sectionIds.length >= 1;
  var showNavInContent = showNav && !embedInCourseDetail;

  function goBack() {
    if (typeof window === "undefined") return;
    if (onBackToOutline) {
      onBackToOutline();
      return;
    }
    var base = courseId && trackId ? COURSE_READER_PATH + "?recordId=" + encodeURIComponent(courseId) + "&trackId=" + encodeURIComponent(trackId) : COURSE_READER_PATH;
    if (personId) base += "&personId=" + encodeURIComponent(personId);
    window.location.href = base;
  }
  function goToSection(id) {
    if (typeof window === "undefined") return;
    if (embedInCourseDetail && onNavigateEmbedSection) {
      onNavigateEmbedSection(id);
      return;
    }
    if (embedInCourseDetail && courseId && trackId) {
      var pc = new URLSearchParams();
      pc.set("recordId", courseId);
      pc.set("trackId", trackId);
      pc.set("section", id);
      if (personId) pc.set("personId", personId);
      window.location.href = COURSE_READER_PATH + "?" + pc.toString();
      return;
    }
    var p = new URLSearchParams();
    p.set("recordId", id);
    if (courseId) p.set("courseId", courseId);
    if (trackId) p.set("trackId", trackId);
    if (sectionIds.length > 0) p.set("sectionIds", sectionIds.join(","));
    if (personId) p.set("personId", personId);
    var rids = getResourceIdsForSection ? getResourceIdsForSection(id) : [];
    if (rids && rids.length > 0) p.set("resourceIds", rids.join(","));
    window.location.href = TRAINING_SESSION_PATH + "?" + p.toString();
  }

  var comprehensionModeEarly = getComprehensionQuestionMode(fields);
  if (comprehensionModeEarly) {
    var qTextComp = get("Question") || getByPartial("question");
    var questionStr = qTextComp != null ? String(qTextComp) : "";
    var choicesV = getComprehensionChoicesRaw(fields);
    var choicesStr =
      Array.isArray(choicesV)
        ? JSON.stringify(choicesV)
        : typeof choicesV === "string"
          ? choicesV
          : choicesV != null
            ? String(choicesV)
            : "";
    var outerPadComp = embedInCourseDetail ? "w-full max-w-full px-0 py-3 md:py-4" : "w-full max-w-full px-4 md:px-6 lg:px-8 py-6 md:py-8";
    return React.createElement(
      "div",
      { className: outerPadComp },
      !embedInCourseDetail
        ? React.createElement(Button, { variant: "ghost", onClick: goBack, className: "mb-4 -ml-2 no-print" }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to All Pages")
        : null,
      React.createElement(ComprehensionCheckSection, {
        recordId: sectionId,
        mode: comprehensionModeEarly,
        question: questionStr,
        choicesJson: choicesStr,
        initialPassed: Boolean(props.comprehensionHydratedPass) || compQuizPassed,
        completedSnapshot: props.comprehensionSnapshot != null ? props.comprehensionSnapshot : null,
        onPassed: function (snapshot) {
          setCompQuizPassed(true);
          try {
            if (typeof window !== "undefined" && sectionId) {
              window.dispatchEvent(
                new CustomEvent("lms-comprehension-passed", { detail: { sectionId: sectionId, snapshot: snapshot } })
              );
            }
          } catch (e) {}
          if (typeof props.onComprehensionPassed === "function") props.onComprehensionPassed(snapshot);
        },
      })
    );
  }

  function renderRichText(content) {
    if (content == null) return null;
    var str;
    if (typeof content === "string") str = content.trim();
    else if (typeof content === "object" && content !== null) str = String(content.html || content.HTML || content.value || content.text || content.plain || "").trim();
    else str = String(content).trim();
    if (str === "") return null;
    var looksLikeNumberedList = /\d+\.\s+.*\d+\.\s+/.test(str) || /^\s*\d+\.\s+/m.test(str);
    var isRawHtml = /<[a-z][\s\S]*>/i.test(str) && !looksLikeNumberedList;
    var html = isRawHtml ? sanitizeRichTextHtml(str) : markdownToHtml(str, embedInCourseDetail);
    var headingProse = lmsRichTextHeadingProse(embedInCourseDetail);
    var proseClass = embedInCourseDetail
      ? "prose prose-sm max-w-none text-black [&_a]:!underline [&_ul]:!pl-8 [&_ol]:!pl-8 [&_ul]:!list-outside [&_ol]:!list-outside " + headingProse
      : "prose prose-base max-w-none text-black [&_a]:!underline [&_ul]:!pl-10 [&_ol]:!pl-10 [&_ul]:!list-outside [&_ol]:!list-outside " + headingProse;
    return React.createElement("div", { className: proseClass, style: { color: "#000", lineHeight: 1.55 }, dangerouslySetInnerHTML: { __html: html } });
  }

  if (!sectionId) {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12" },
      React.createElement("div", { className: "text-center" },
        React.createElement("p", { className: "text-muted-foreground mb-6" }, "No section selected."),
        React.createElement(Button, { variant: "outline", onClick: goBack }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to All Pages")
      )
    );
  }

  if (sectionStatus === "pending") {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[200px]" },
      React.createElement("div", { className: "h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" }),
      React.createElement("p", { className: "text-muted-foreground" }, "Loading...")
    );
  }

  if (sectionStatus === "error" || !section) {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12 text-center" },
      React.createElement("p", { className: "text-destructive mb-6" }, "Could not load this page."),
      React.createElement(Button, { variant: "outline", onClick: goBack }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to All Pages")
    );
  }

  var embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  var contentEls = [];

  if (sectionType === "Video" && videoUrl) {
    contentEls.push(
      React.createElement("div", { key: "vid", className: "space-y-2" },
        React.createElement("div", { className: "aspect-video rounded-lg overflow-hidden bg-muted w-full" },
          embedUrl
            ? React.createElement("iframe", { src: embedUrl, className: "w-full h-full", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share", allowFullScreen: true, referrerPolicy: "strict-origin-when-cross-origin", title: "Section video" })
            : React.createElement("div", { className: "w-full h-full flex flex-col items-center justify-center gap-3 p-4" },
                React.createElement(Video, { className: "h-12 w-12 text-muted-foreground" }),
                React.createElement(Button, { asChild: true, variant: "outline", size: "lg" }, React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer" }, "Watch video"))
              )
        ),
        React.createElement("p", { className: "text-sm text-muted-foreground" },
          embedUrl ? React.createElement(React.Fragment, null, "If the video doesn't play, ", React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline" }, "open it in a new tab"), ".") : React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline" }, "Open video link")
        )
      )
    );
  }
  if (body != null && String(body).trim() !== "" && sectionType !== "Checklist" && sectionType !== "Survey") contentEls.push(React.createElement("div", { key: "body" }, renderRichText(body)));
  if (contentEls.length === 0 && body != null && String(body).trim() !== "" && sectionType !== "Checklist" && sectionType !== "Survey") contentEls.push(React.createElement("div", { key: "body-fallback" }, renderRichText(body)));
  if (sectionType === "Checklist" && body != null && String(body).trim() !== "") {
    var checklistTree = parseChecklistToTree(body);
    function renderChecklistNodes(nodes, pathPrefix) {
      if (!nodes || nodes.length === 0) return null;
      return nodes.map(function (node, idx) {
        var path = pathPrefix ? pathPrefix + "-" + idx : String(idx);
        var itemText = node.text;
        var isChecked = checklistState[path] || false;
        return React.createElement("div", { key: path, className: "checklist-item" },
          React.createElement("div", { className: "flex items-start gap-3 py-2", style: pathPrefix ? { paddingLeft: (path.split("-").length * 20) + "px" } : {} },
            React.createElement(Checkbox, {
              id: "check-" + path,
              checked: isChecked,
              onCheckedChange: function () { setChecklistState(function (prev) { var next = {}; for (var k in prev) next[k] = prev[k]; next[path] = !prev[path]; return next; }); },
              className: "mt-1.5 shrink-0 rounded border-2 border-primary"
            }),
            React.createElement("label", { htmlFor: "check-" + path, className: cn("flex-1 cursor-pointer text-black leading-relaxed", isChecked ? "line-through text-muted-foreground" : ""), style: { color: "#000" } }, itemText)
          ),
          node.children && node.children.length > 0 ? React.createElement("div", { className: "ml-0" }, renderChecklistNodes(node.children, path)) : null
        );
      });
    }
    contentEls.push(
      React.createElement("div", { key: "check", className: "section-checklist-print-area" },
        React.createElement("div", { className: "print-only mb-4", "aria-hidden": "true" }, React.createElement("h1", { className: "text-2xl font-bold text-center", style: { color: "#E61C39" } }, sectionTitle)),
        React.createElement("div", { className: "space-y-1" }, renderChecklistNodes(checklistTree, "")),
        React.createElement("div", { className: "pt-4 no-print" }, React.createElement(Button, { onClick: function () { openChecklistPrintWindow(sectionTitle, checklistTree, checklistState); }, variant: "outline", className: "w-full", size: "lg" }, React.createElement(Download, { className: "mr-2 h-4 w-4" }), " Download PDF"))
      )
    );
  }
  if (sectionType === "Survey") {
    if (body != null && String(body).trim() !== "") contentEls.push(React.createElement("div", { key: "survBody", className: "mb-6" }, renderRichText(body)));
    var surveySrc = surveyLink && surveyLink.length > 0 ? surveyLink : null;
    if (surveySrc && !/^https?:\/\//i.test(surveySrc)) surveySrc = "https://" + surveySrc;
    if (surveySrc) {
      var surveyHref = surveySrc;
      if (personId) {
        var sep = surveySrc.indexOf("?") !== -1 ? "&" : "?";
        surveyHref =
          surveySrc +
          sep +
          "personId=" +
          encodeURIComponent(personId) +
          "&prefill_Personnel%20Record%20ID=" +
          encodeURIComponent(personId) +
          "&prefill_Contact%20Record%20ID=" +
          encodeURIComponent(personId);
      }
      var surveyBleedStyle = embedInCourseDetail ? { width: "100vw", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" } : undefined;
      var surveyFrameMin = embedInCourseDetail ? "min(78vh, 920px)" : "600px";
      contentEls.push(
        React.createElement("div", { key: "survEmbed", className: "w-full", style: surveyBleedStyle },
          React.createElement("div", { className: "w-full rounded-lg overflow-hidden border border-border", style: { minHeight: surveyFrameMin } }, React.createElement("iframe", { src: surveyHref, title: "Survey", className: embedInCourseDetail ? "w-full min-h-[70vh] border-0" : "w-full min-h-[600px] border-0", style: { minHeight: surveyFrameMin } })),
          React.createElement("p", { className: "mt-3 text-sm text-muted-foreground px-1" }, "If the form doesn\u2019t appear above, ", React.createElement("a", { href: surveyHref, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline" }, "open it in a new tab"), ".")
        )
      );
    } else if (isSurveyOrSubmission) {
      contentEls.push(React.createElement("div", { key: "survMissing", className: "rounded-lg border border-border bg-muted/30 p-6 text-center text-muted-foreground" }, "Add a survey or form URL to the \u201cSurvey Link\u201d (or similar) field in Airtable for this section to show the form here."));
    }
  }

  if (sectionType === "Text + Photo" && galleryImages.length > 0) {
    contentEls.push(
      React.createElement("div", { key: "photo-inline", className: "w-full space-y-4" },
        galleryImages.map(function (g, idx) {
          return React.createElement("button", {
            type: "button",
            key: "photo-" + idx,
            className: "block w-full rounded-lg overflow-hidden border border-border bg-muted/20 p-0 cursor-zoom-in text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            onClick: function () { setLightbox({ url: g.url, name: g.name }); },
            "aria-label": "View larger: " + g.name
          },
            React.createElement("img", { src: g.url, alt: g.name, className: "w-full h-auto object-contain", loading: idx > 0 ? "lazy" : undefined })
          );
        })
      )
    );
  }

  if (sectionType === "Text + Gallery" && galleryImages.length > 0) {
    var galIdx = Math.min(Math.max(0, galleryIndex), galleryImages.length - 1);
    var galPrev = function () { setGalleryIndex(function (i) { return Math.max(0, i - 1); }); };
    var galNext = function () { setGalleryIndex(function (i) { return Math.min(galleryImages.length - 1, i + 1); }); };
    contentEls.push(
      React.createElement("div", { key: "gallery", className: "w-full" },
        React.createElement("div", { className: "relative flex items-center justify-center gap-2 w-full rounded-lg overflow-hidden bg-muted/30 border border-border" },
          React.createElement(Button, { type: "button", variant: "outline", size: "icon", "aria-label": "Previous image", onClick: galPrev, disabled: galIdx <= 0, className: "absolute left-2 top-1/2 -translate-y-1/2 z-10 shrink-0" }, React.createElement(ChevronLeft, { className: "h-6 w-6" })),
          React.createElement("img", { src: galleryImages[galIdx].url, alt: galleryImages[galIdx].name, className: "max-w-full max-h-[70vh] w-auto h-auto object-contain" }),
          React.createElement(Button, { type: "button", variant: "outline", size: "icon", "aria-label": "Next image", onClick: galNext, disabled: galIdx >= galleryImages.length - 1, className: "absolute right-2 top-1/2 -translate-y-1/2 z-10 shrink-0" }, React.createElement(ChevronRight, { className: "h-6 w-6" }))
        ),
        React.createElement("p", { className: "text-center text-sm text-muted-foreground mt-2" }, (galIdx + 1) + " / " + galleryImages.length)
      )
    );
  }

  var isLastSection = sectionIds.length > 0 && currentIndex === sectionIds.length - 1;
  function onFinish() {
    recordCourseComplete(personId, courseId);
    if (typeof window === "undefined") return;
    var rid = resolveFinishTrackRecordId({ trackIdFromUrl: trackId, linkedLearningTrackIds: linkedLearningTrackIds });
    window.location.href = buildTrackViewHref(personId, rid);
  }
  if (showNavInContent) {
    contentEls.push(
      React.createElement("div", { key: "nav", className: "flex items-center justify-between gap-4 pt-6 border-t border-border/50 no-print" },
        React.createElement(Button, { variant: "outline", onClick: function () { if (prevId) goToSection(prevId); }, disabled: !prevId, className: "flex-1" }, React.createElement(ChevronLeft, { className: "mr-2 h-4 w-4" }), " Previous Page"),
        React.createElement("span", { className: "text-sm text-muted-foreground whitespace-nowrap" }, (currentIndex + 1) + " of " + sectionIds.length),
        isLastSection
          ? React.createElement(Button, { variant: "default", onClick: onFinish, className: "flex-1 bg-primary text-primary-foreground hover:bg-primary/90" }, " Finish", React.createElement(ChevronRight, { className: "ml-2 h-4 w-4" }))
          : React.createElement(Button, { variant: "outline", onClick: function () { if (nextId) goToSection(nextId); }, disabled: !nextId, className: "flex-1" }, " Next Page", React.createElement(ChevronRight, { className: "ml-2 h-4 w-4" }))
      )
    );
  }

  var outerPad = embedInCourseDetail ? "w-full max-w-full px-0 py-3 md:py-4" : "w-full max-w-full px-4 md:px-6 lg:px-8 py-6 md:py-8";
  var titleClass = lmsSectionTitleClass(embedInCourseDetail);
  return React.createElement("div", { className: outerPad },
    React.createElement("style", { dangerouslySetInnerHTML: { __html: ".print-only { display: none; } @media print { .no-print { display: none !important; } .print-only { display: block !important; } body * { visibility: hidden; } .section-checklist-print-area, .section-checklist-print-area * { visibility: visible; } .section-checklist-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 1rem 1.5rem; } }" } }),
    React.createElement("div", { className: embedInCourseDetail ? "w-full max-w-none mx-auto" : "w-full max-w-[1600px] mx-auto" },
      !embedInCourseDetail
        ? React.createElement(Button, { variant: "ghost", onClick: goBack, className: "mb-4 -ml-2 no-print" }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to All Pages")
        : null,
      React.createElement(Card, { className: "mb-2 border-0 shadow-none bg-transparent" },
        React.createElement(CardHeader, { className: "px-0 pt-0 no-print pb-2" }, React.createElement(CardTitle, { className: titleClass }, sectionTitle)),
        React.createElement(CardContent, { className: "px-0 space-y-4" }, contentEls)
      )
    ),
    lightbox
      ? React.createElement("div", {
          className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 no-print",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Image preview",
          onClick: function (e) { if (e.target === e.currentTarget) setLightbox(null); }
        },
          React.createElement(Button, {
            type: "button",
            variant: "secondary",
            size: "icon",
            className: "absolute right-4 top-4 z-[101] rounded-full shadow-md",
            "aria-label": "Close",
            onClick: function () { setLightbox(null); }
          }, React.createElement(X, { className: "h-5 w-5" })),
          React.createElement("img", {
            src: lightbox.url,
            alt: lightbox.name || "",
            className: "max-h-[min(92vh,1200px)] max-w-full w-auto object-contain rounded-md shadow-lg",
            onClick: function (e) { e.stopPropagation(); }
          })
        )
      : null
  );
}
