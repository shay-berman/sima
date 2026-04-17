const allowedDocs = new Set([
  "SIMA_BERMAN_RESEARCH_BACKUP.md",
  "RESEARCH_TRACKER.md",
  "ARCHIVE_ACTION_PLAN.md",
  "ARCHIVE_SUBMISSIONS_READY.md",
  "READY_TO_SEND_EMAILS.md",
  "SIMA_PRE_IMMIGRATION_IDENTITY.md",
  "SIMA_BERMAN_FAMILY_SHARE.md",
  "SIMA_BERMAN_FAMILY_SHARE_HE.md",
  "HOW_TO_CONTINUE_THIS_RESEARCH.md",
]);

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineFormat(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inList = false;
  let inCode = false;
  let inParagraph = false;

  function closeParagraph() {
    if (inParagraph) {
      html += "</p>";
      inParagraph = false;
    }
  }

  function closeList() {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      closeParagraph();
      closeList();
      if (!inCode) {
        html += "<pre><code>";
        inCode = true;
      } else {
        html += "</code></pre>";
        inCode = false;
      }
      continue;
    }

    if (inCode) {
      html += `${escapeHtml(rawLine)}\n`;
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      closeParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineFormat(line.slice(2))}</li>`;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      closeParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineFormat(ordered[1])}</li>`;
      continue;
    }

    closeList();
    if (!inParagraph) {
      html += "<p>";
      inParagraph = true;
    } else {
      html += " ";
    }
    html += inlineFormat(line);
  }

  closeParagraph();
  closeList();
  if (inCode) {
    html += "</code></pre>";
  }

  return html;
}

async function loadDoc() {
  const params = new URLSearchParams(window.location.search);
  const doc = params.get("doc") || "README.md";
  const titleEl = document.getElementById("doc-title");
  const contentEl = document.getElementById("doc-content");
  const rawLink = document.getElementById("raw-link");

  if (!allowedDocs.has(doc)) {
    titleEl.textContent = "Document not available";
    contentEl.innerHTML = "<p>This document is not available in the web viewer.</p>";
    rawLink.hidden = true;
    return;
  }

  titleEl.textContent = doc.replace(/\.md$/, "").replaceAll("_", " ");
  rawLink.href = `./${doc}`;

  try {
    const response = await fetch(`./${doc}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${doc}`);
    }
    const markdown = await response.text();
    contentEl.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    titleEl.textContent = "Load error";
    contentEl.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

if (document.getElementById("doc-content")) {
  loadDoc();
}
