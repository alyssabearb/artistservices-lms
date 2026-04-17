/**
 * Page 4: Section Detail — SINGLE BLOCK (all-in-one, no custom resource card formatting).
 * Use this ONLY if you want one block. For custom resource type formatting (PDF, Contact, Video cards, etc.),
 * use the TWO-BLOCK setup instead: Section Content block + ResourcesOnly + Resource Library block.
 * Block data source: Training Sections.
 * URL: ?recordId=...&courseId=...&trackId=...&sectionIds=id1,id2,id3
 */
import React, { useState, useMemo } from "react";
import { useRecord, useRecords, q } from "@/lib/datasource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Download, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const sectionSelect = q.select({
  title: "Section Title",
  body: "Section Body",
  type: "Section Type",
  video: "Section Video",
  surveyLink: "Survey Link",
  linkedResources: "Linked Resources",
  recordId: "RecordID",
});

const resourcesSelect = q.select({
  title: "Resource Title",
  description: "Description",
  type: "Resource Type",
  photo: "Resource Photo",
  link: "Resource Link",
  documentation: "Resource Documentation",
  date: "Date",
  surveyLink: "Survey Link",
  recordId: "RecordID",
});

function isDocumentUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = String(url).split("?")[0].split("#")[0];
  return /\.(doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i.test(u) || /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(u);
}

function isWordExcelType(typeStr) {
  if (!typeStr || typeof typeStr !== "string") return false;
  const t = typeStr.toLowerCase().trim();
  return t === "word/excel file" || t === "word/excel" || t === "document" || t === "word" || t === "excel" || t === "checklist" || t === "template" || t.indexOf("checklist") !== -1 || t.indexOf("template") !== -1 || t.indexOf("word") !== -1 || t.indexOf("excel") !== -1;
}

function markdownToHtml(md) {
  if (!md || typeof md !== "string") return "";
  let out = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const refs = {};
  out = out.replace(/\[\s*(\d+)\s*\]\s*:\s*(\S+)(?:\s+["']([^"']*)["'])?/g, function (_, n, url) { refs[n] = url; return ""; });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = out.split("\n");
  const result = [];
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/) || line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2].trim();
      if (!inList) { result.push("<ul style=\"list-style-type:disc;padding-left:1.5rem;margin:0.35rem 0 0.5rem 0\">"); inList = true; }
      result.push("<li class=\"leading-relaxed\">" + content + "</li>");
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      const t = line.trim();
      result.push(t === "" ? "<p style=\"margin:0.15rem 0\">&nbsp;</p>" : "<p style=\"margin:0.35rem 0 0.5rem 0;line-height:1.6\">" + t + "</p>");
    }
  }
  if (inList) result.push("</ul>");
  return result.join("\n");
}

function getVideoEmbedUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const v = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (v && v[1]) return "https://player.vimeo.com/video/" + v[1] + "?title=0&byline=0&portrait=0";
  const yShort = u.match(/youtube\.com\/shorts\/([^/?&]{11})/i);
  if (yShort && yShort[1]) return "https://www.youtube.com/embed/" + yShort[1] + "?modestbranding=1&rel=0";
  const yWatch = u.match(/(?:youtube\.com\/watch\?.*[?&]v=|youtube\.com\/embed\/|youtu\.be\/)([^"&?/ ]{11})/i);
  if (yWatch && yWatch[1]) return "https://www.youtube.com/embed/" + yWatch[1] + "?modestbranding=1&rel=0";
  const yLegacy = u.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i);
  if (yLegacy && yLegacy[1]) return "https://www.youtube.com/embed/" + yLegacy[1] + "?modestbranding=1&rel=0";
  return null;
}

function getParamsFromUrl() {
  if (typeof window === "undefined") return { recordId: null, courseId: null, trackId: null, sectionIds: [] };
  const params = new URLSearchParams(window.location.search);
  const ids = params.get("sectionIds");
  return {
    recordId: params.get("recordId"),
    courseId: params.get("courseId"),
    trackId: params.get("trackId"),
    sectionIds: ids ? ids.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : []
  };
}

function getLinkedId(linked) {
  if (linked == null) return null;
  if (typeof linked === "string") return linked;
  const id = linked.id || linked.recordId || linked.RecordID;
  if (id != null && typeof id === "string") return id;
  return null;
}

function getResourceTitle(obj, obj2) {
  const all = Object.assign({}, obj || {}, obj2 || {});
  const v = all["Resource Title"];
  if (v != null && String(v).trim()) return String(v).trim();
  for (const k in all) {
    if (k.toLowerCase().indexOf("resource") !== -1 && k.toLowerCase().indexOf("title") !== -1) {
      const val = all[k];
      if (val != null && String(val).trim()) return String(val).trim();
    }
  }
  return String(all.label || all.name || all.title || all["Title"] || "Resource").trim() || "Resource";
}

function getYtThumb(url) {
  const m = url && url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/);
  return m && m[1] ? "https://img.youtube.com/vi/" + m[1] + "/maxresdefault.jpg" : null;
}

function ResourceCardEl({ resource, getYtThumb }) {
  const f = resource.fields || {};
  const type = String(f.type || f["Resource Type"] || "External Link").trim();
  const title = getResourceTitle(f);
  const desc = f.description || f["Resource Description"];
  const photoArr = Array.isArray(f.photo) ? f.photo : Array.isArray(f["Resource Photo"]) ? f["Resource Photo"] : [];
  const photoUrl = photoArr[0] && photoArr[0].url ? photoArr[0].url : null;
  const link = typeof f.link === "string" ? f.link : typeof f["Resource Link"] === "string" ? f["Resource Link"] : null;
  const surveyLink = typeof f.surveyLink === "string" ? f.surveyLink : typeof f["Survey Link"] === "string" ? f["Survey Link"] : null;
  const docArr = Array.isArray(f.documentation) ? f.documentation : Array.isArray(f["Resource Documentation"]) ? f["Resource Documentation"] : [];
  const docUrl = docArr[0] && docArr[0].url ? docArr[0].url : null;
  const dateVal = f.date;
  const thumb = link ? getYtThumb(link) : null;
  const wordExcelLike = isWordExcelType(type) && docUrl;
  const safePhotoForDoc = !wordExcelLike ? true : !photoUrl || (photoUrl !== docUrl && !isDocumentUrl(photoUrl));
  const headerImg = wordExcelLike ? (thumb || (safePhotoForDoc ? photoUrl : null)) : (thumb || photoUrl);
  const fullW = ["Text", "Recording", "Webinar RSVP"].indexOf(type) !== -1;
  const colClass = fullW ? "md:col-span-3" : "md:col-span-1";
  const linkIsDoc = link && isDocumentUrl(link);
  const safeLink = link && !linkIsDoc ? link : null;

  const titleNode = React.createElement("span", { className: "text-lg font-semibold text-black leading-relaxed", style: { color: "#000" } }, title);
  const wrappedTitle = safeLink
    ? React.createElement("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", className: "hover:underline focus:underline" }, titleNode)
    : titleNode;

  const children = [];
  if (type === "Contact" && photoUrl) {
    children.push(
      React.createElement("div", { key: "c", className: "pt-6 flex flex-col items-center text-center" },
        React.createElement("img", { src: photoUrl, alt: title, className: "w-24 h-24 rounded-full object-cover mb-4" }),
        React.createElement("p", { className: "text-lg font-semibold text-center text-black", style: { color: "#000" } }, title),
        desc ? React.createElement("p", { className: "mt-2 text-center text-black/90 leading-relaxed" }, String(desc)) : null
      )
    );
  } else {
    if (headerImg && type !== "Contact" && !isDocumentUrl(headerImg)) {
      const img = React.createElement("img", { src: headerImg, alt: title, className: "w-full h-full object-cover" });
      children.push(
        React.createElement("div", { key: "img", className: "overflow-hidden rounded-lg aspect-video mb-3" },
          safeLink ? React.createElement("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer" }, img) : img
        )
      );
    }
    const inner = [React.createElement("p", { key: "t", className: "text-center" }, wrappedTitle)];
    if (desc) inner.push(React.createElement("p", { key: "d", className: cn("mt-1 leading-relaxed text-black/90", fullW ? "" : "line-clamp-2"), style: { color: "#000" } }, String(desc)));
    if (type === "Webinar RSVP" && dateVal) inner.push(React.createElement("p", { key: "dt", className: "text-sm mt-1 opacity-80" }, new Date(String(dateVal)).toLocaleDateString()));
    children.push(React.createElement("div", { key: "body", className: "flex flex-col items-center text-center" }, inner));
    const btns = [];
    if (type === "Video" && link) btns.push(React.createElement(Button, { key: "v", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Watch →")));
    if ((type === "PDF" || type === "Image") && docUrl) btns.push(React.createElement(Button, { key: "pdf", type: "button", variant: "outline", size: "sm", onClick: function () { if (typeof window !== "undefined" && docUrl) window.open(docUrl, "_blank", "noopener,noreferrer"); } }, React.createElement(Download, { className: "mr-2 h-4 w-4" }), " Download"));
    if (wordExcelLike) {
      btns.push(React.createElement(Button, { key: "preview", type: "button", variant: "outline", size: "sm", onClick: function () { if (typeof window !== "undefined" && docUrl) window.open(docUrl, "_blank", "noopener,noreferrer"); } }, "Preview"));
      btns.push(React.createElement(Button, { key: "doc", type: "button", variant: "outline", size: "sm", onClick: function () { if (typeof window !== "undefined" && docUrl) window.open(docUrl, "_blank", "noopener,noreferrer"); } }, React.createElement(Download, { className: "mr-2 h-4 w-4" }), " Download File"));
    }
    if (type === "External Link" && link) btns.push(React.createElement(Button, { key: "ext", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Go →")));
    if (type === "Submission Link" && surveyLink) btns.push(React.createElement(Button, { key: "surv", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: surveyLink, rel: "noopener noreferrer" }, "Open")));
    if (type === "Backstage Site Link" && link) btns.push(React.createElement(Button, { key: "bs", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Go →")));
    if (type === "Recording" && link) btns.push(React.createElement(Button, { key: "rec", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Watch →")));
    if (type === "Webinar RSVP" && link) btns.push(React.createElement(Button, { key: "wb", asChild: true, variant: "outline", size: "sm" }, React.createElement("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Register →")));
    children.push(React.createElement("div", { key: "btns", className: "mt-3 flex flex-col items-center" }, btns));
  }

  return React.createElement("div", { className: cn("flex flex-col bg-transparent border-0 shadow-none", colClass) }, children);
}

export default function Block() {
  const params = useMemo(getParamsFromUrl, []);
  const sectionId = params.recordId;
  const courseId = params.courseId;
  const trackId = params.trackId;
  const sectionIds = params.sectionIds || [];

  const [checklistState, setChecklistState] = useState({});

  const { data: section, status: sectionStatus } = useRecord({
    recordId: sectionId || undefined,
    select: sectionSelect
  });

  const sectionRecord = section;
  const fields = (section && section.fields) ? section.fields : (sectionRecord || {});

  function get() {
    for (var i = 0; i < arguments.length; i++) {
      var v = fields[arguments[i]] || (sectionRecord && sectionRecord[arguments[i]]);
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }
  function getByPartial(sub) {
    var all = Object.assign({}, fields, (sectionRecord && typeof sectionRecord === "object" ? sectionRecord : {}));
    for (var k in all) {
      if (k.toLowerCase().indexOf(sub.toLowerCase()) !== -1) {
        var v = all[k];
        if (v !== undefined && v !== null) return v;
      }
    }
    return undefined;
  }

  var bodyRaw = get("body", "Section Body") || getByPartial("body");
  var body = bodyRaw;
  if (body != null && typeof body === "object" && !Array.isArray(body)) body = body.html || body.HTML || body.value || body.text || body.plain || body.content || null;
  if (body != null && typeof body !== "string") body = String(body);

  var sectionTypeRaw = get("type", "Section Type") || getByPartial("section type");
  if (sectionTypeRaw != null && typeof sectionTypeRaw === "object" && !Array.isArray(sectionTypeRaw)) sectionTypeRaw = sectionTypeRaw.name || sectionTypeRaw.value || sectionTypeRaw.label;
  var sectionType = String(sectionTypeRaw || "Text").trim();
  var sectionTypeLower = sectionType.toLowerCase();
  if (sectionTypeLower === "text" || sectionTypeLower === "text + links" || sectionTypeLower === "text+links" || (sectionTypeLower.indexOf("text") !== -1 && sectionTypeLower.indexOf("link") !== -1)) sectionType = "Text";
  else if (sectionTypeLower === "video" || sectionTypeLower.indexOf("video") !== -1) sectionType = "Video";
  else if (sectionTypeLower === "checklist") sectionType = "Checklist";
  else if (sectionTypeLower === "survey") sectionType = "Survey";

  const videoRaw = get("video", "Section Video") || getByPartial("video");
  let videoUrl;
  if (typeof videoRaw === "string") videoUrl = videoRaw;
  else if (Array.isArray(videoRaw) && videoRaw[0] && typeof videoRaw[0] === "object" && videoRaw[0].url) videoUrl = videoRaw[0].url;
  else if (videoRaw && videoRaw.url) videoUrl = videoRaw.url;
  else videoUrl = undefined;

  const surveyLink = get("surveyLink", "Survey Link");
  const linkedResRaw = get("linkedResources", "Linked Resources") || getByPartial("linked") || getByPartial("resource");
  const linkedArray = Array.isArray(linkedResRaw) ? linkedResRaw : [];
  const hasLinkedResources = linkedArray.length > 0;

  const resourceIds = linkedArray.map(function (r) { return typeof r === "string" ? r : getLinkedId(r); }).filter(Boolean);
  const { data: resourcesData } = useRecords({
    select: resourcesSelect,
    where: resourceIds.length > 0 ? q.text("recordId").isOneOf(resourceIds) : undefined,
    count: 100
  });

  const fetchedPages = (resourcesData && resourcesData.pages) ? resourcesData.pages : [];
  const fetchedItems = [];
  for (let i = 0; i < fetchedPages.length; i++) fetchedItems.push.apply(fetchedItems, fetchedPages[i].items || []);
  const resources = resourceIds.length > 0 ? fetchedItems.filter(function (r) {
    const rid = r.id || (r.fields && (r.fields.recordId || r.fields.RecordID));
    return rid && (resourceIds.indexOf(r.id) !== -1 || resourceIds.indexOf(String(rid)) !== -1);
  }) : [];

  const minimalRes = linkedArray.map(function (r) {
    if (!r) return null;
    const id = typeof r === "string" ? r : getLinkedId(r);
    const o = typeof r === "object" && r ? r : {};
    const raw = o.fields || o;
    if (!id) return null;
    return {
      id: id,
      fields: {
        title: getResourceTitle(raw, o),
        type: raw["Resource Type"] || raw.type || "External Link",
        description: raw["Resource Description"] || raw.description,
        link: raw["Resource Link"] || raw.link,
        photo: raw["Resource Photo"] || raw.photo,
        documentation: raw["Resource Documentation"] || raw.documentation,
        date: raw.date,
        surveyLink: raw["Survey Link"]
      }
    };
  }).filter(Boolean);

  const allResources = resources.length > 0 ? resources : minimalRes;

  const currentIndex = sectionId && sectionIds.length > 0 ? sectionIds.indexOf(sectionId) : -1;
  const prevId = currentIndex > 0 ? sectionIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < sectionIds.length - 1 ? sectionIds[currentIndex + 1] : null;

  function goBack() {
    if (typeof window === "undefined") return;
    var base = courseId && trackId ? "/course-detail?recordId=" + encodeURIComponent(courseId) + "&trackId=" + encodeURIComponent(trackId) : "/course-detail";
    window.location.href = base;
  }
  function goToSection(id) {
    if (typeof window === "undefined") return;
    var params = new URLSearchParams();
    params.set("recordId", id);
    if (courseId) params.set("courseId", courseId);
    if (trackId) params.set("trackId", trackId);
    if (sectionIds.length > 0) params.set("sectionIds", sectionIds.join(","));
    window.location.href = window.location.pathname + "?" + params.toString();
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

  function renderRichText(content) {
    if (content == null) return null;
    var str;
    if (typeof content === "string") str = content.trim();
    else if (typeof content === "object" && content !== null) str = String(content.html || content.HTML || content.value || content.text || content.plain || JSON.stringify(content)).trim();
    else str = String(content).trim();
    if (str === "") return null;
    var html = /<[a-z][\s\S]*>/i.test(str) ? str : markdownToHtml(str);
    return React.createElement("div", {
      className: "prose prose-lg max-w-none text-black",
      style: { color: "#000", lineHeight: 1.6 },
      dangerouslySetInnerHTML: { __html: html }
    });
  }

  if (!sectionId) {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12" },
      React.createElement("div", { className: "text-center" },
        React.createElement("p", { className: "text-muted-foreground mb-6" }, "No section selected. Use the course page to open a page."),
        React.createElement(Button, { variant: "outline", onClick: goBack }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to Course")
      )
    );
  }

  if (sectionStatus === "pending") {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center min-h-[300px]" },
      React.createElement("div", { className: "h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" }),
      React.createElement("p", { className: "text-muted-foreground" }, "Loading...")
    );
  }

  if (sectionStatus === "error" || !section) {
    return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 py-12 text-center" },
      React.createElement("p", { className: "text-destructive mb-6" }, "Could not load this page. Ensure this block is connected to the Training Sections table."),
      React.createElement(Button, { variant: "outline", onClick: goBack }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to Course")
    );
  }

  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  const navEl = sectionIds.length > 1 && (allResources.length > 0 ? true : !hasLinkedResources)
    ? React.createElement("div", { className: "flex items-center justify-between gap-4 pt-6 border-t border-border/50" },
        React.createElement(Button, { variant: "outline", onClick: function () { if (prevId) goToSection(prevId); }, disabled: !prevId, className: "flex-1" }, React.createElement(ChevronLeft, { className: "mr-2 h-4 w-4" }), " Previous Page"),
        React.createElement("span", { className: "text-sm text-muted-foreground whitespace-nowrap" }, (currentIndex + 1) + " of " + sectionIds.length),
        React.createElement(Button, { variant: "outline", onClick: function () { if (nextId) goToSection(nextId); }, disabled: !nextId, className: "flex-1" }, " Next Page", React.createElement(ChevronRight, { className: "ml-2 h-4 w-4" }))
      )
    : null;

  const contentEls = [];
  if (sectionType === "Video" && videoUrl) {
    contentEls.push(
      React.createElement("div", { key: "vid", className: "space-y-2" },
        React.createElement("div", { className: "aspect-video rounded-lg overflow-hidden bg-muted w-full" },
          embedUrl
            ? React.createElement("iframe", { src: embedUrl, className: "w-full h-full", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, title: "Section video" })
            : React.createElement("div", { className: "w-full h-full flex flex-col items-center justify-center gap-3 p-4" },
                React.createElement(Video, { className: "h-12 w-12 text-muted-foreground" }),
                React.createElement(Button, { asChild: true, variant: "outline", size: "lg" }, React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer" }, "Watch video"))
              )
        ),
        React.createElement("p", { className: "text-sm text-muted-foreground" },
          embedUrl
            ? React.createElement(React.Fragment, null, "If the video doesn't play, ", React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline" }, "open it in a new tab"), ".")
            : React.createElement("a", { href: videoUrl, target: "_blank", rel: "noopener noreferrer", className: "text-primary underline" }, "Open video link")
        )
      )
    );
  }
  if (body != null && String(body).trim() !== "" && sectionType !== "Checklist") contentEls.push(React.createElement("div", { key: "body" }, renderRichText(body)));
  if (contentEls.length === 0 && body != null && String(body).trim() !== "" && sectionType !== "Checklist") contentEls.push(React.createElement("div", { key: "body-fallback" }, renderRichText(body)));
  if (sectionType === "Checklist" && body != null && String(body).trim() !== "") {
    const lines = String(body).split("\n").filter(function (line) { return line.trim(); });
    contentEls.push(
      React.createElement("div", { key: "check", className: "space-y-3" },
        lines.map(function (item, idx) {
          const itemText = item.replace(/^\[\s*\]\s*/, "").replace(/^\[\s*[xX]\s*\]\s*/, "").replace(/^[-*]\s*/, "").trim();
          if (!itemText) return null;
          return React.createElement("div", { key: idx, className: "flex items-start gap-3 py-2" },
            React.createElement(Checkbox, {
              id: "check-" + idx,
              checked: checklistState[itemText] || false,
              onCheckedChange: function () { setChecklistState(function (prev) { var next = {}; for (var k in prev) next[k] = prev[k]; next[itemText] = !prev[itemText]; return next; }); },
              className: "mt-1.5 shrink-0 rounded border-2 border-primary"
            }),
            React.createElement("label", { htmlFor: "check-" + idx, className: cn("flex-1 cursor-pointer text-black leading-relaxed", checklistState[itemText] ? "line-through text-muted-foreground" : ""), style: { color: "#000" } }, itemText)
          );
        }),
        React.createElement("div", { className: "pt-4" }, React.createElement(Button, { onClick: function () { alert("PDF download will be implemented with jsPDF"); }, variant: "outline", className: "w-full", size: "lg" }, React.createElement(Download, { className: "mr-2 h-4 w-4" }), " Download PDF"))
      )
    );
  }
  if (sectionType === "Survey") {
    if (body != null && String(body).trim() !== "") contentEls.push(React.createElement("div", { key: "survBody", className: "mb-6" }, renderRichText(body)));
    if (surveyLink) contentEls.push(React.createElement("div", { key: "survBtn", className: "text-center py-6" }, React.createElement(Button, { asChild: true, size: "lg" }, React.createElement("a", { href: surveyLink, rel: "noopener noreferrer" }, "Take Survey ", React.createElement(ExternalLink, { className: "ml-2 h-4 w-4" })))));
  }
  if (allResources.length > 0) {
    const todayTime = new Date().setHours(0, 0, 0, 0);
    const filteredRes = allResources.filter(function (r) {
      var f = r.fields || {};
      if (String(f.type || "").trim() !== "Webinar RSVP") return true;
      var d = f.date;
      if (!d) return true;
      var dt = new Date(String(d)); dt.setHours(0, 0, 0, 0);
      return dt.getTime() >= todayTime;
    });
    contentEls.push(
      React.createElement("div", { key: "resources", className: "pt-6 border-t border-border/50" },
        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
          filteredRes.map(function (r) { return React.createElement(ResourceCardEl, { key: r.id, resource: r, getYtThumb: getYtThumb }); })
        )
      )
    );
  }
  if (navEl) contentEls.push(navEl);

  return React.createElement("div", { className: "w-full max-w-full px-4 md:px-6 lg:px-8 py-8 md:py-12" },
    React.createElement("div", { className: "w-full max-w-[1600px] mx-auto" },
      React.createElement(Button, { variant: "ghost", onClick: goBack, className: "mb-6 -ml-2" }, React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4" }), " Back to Course"),
      React.createElement(Card, { className: "mb-8 border-0 shadow-none bg-transparent" },
        React.createElement(CardHeader, { className: "px-0 pt-0" }, React.createElement(CardTitle, { className: "text-2xl font-bold", style: { color: "#E61C39" } }, sectionTitle)),
        React.createElement(CardContent, { className: "space-y-6" }, contentEls)
      )
    )
  );
}
