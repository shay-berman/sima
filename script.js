const allowedDocs = new Set([
  "README.md",
  "RESEARCH_LOG.md",
  "RESEARCH_TRACKER.md",
  "ARCHIVE_ACTION_PLAN.md",
  "FINDINGS_OVERVIEW.md",
  "ARCHIVE_SUBMISSIONS_READY.md",
  "READY_TO_SEND_EMAILS.md",
  "SIMA_PRE_IMMIGRATION_IDENTITY.md",
  "SIMA_BERMAN_FAMILY_SHARE.md",
  "SIMA_BERMAN_FAMILY_SHARE_HE.md",
  "HOW_TO_CONTINUE_THIS_RESEARCH.md",
  "TODO_ROADMAP.md",
]);

const docCatalog = [
  { file: "README.md", label: "README" },
  { file: "RESEARCH_LOG.md", label: "Research Log" },
  { file: "RESEARCH_TRACKER.md", label: "Tracker" },
  { file: "ARCHIVE_ACTION_PLAN.md", label: "Archive Action Plan" },
  { file: "ARCHIVE_SUBMISSIONS_READY.md", label: "Archive Submissions" },
  { file: "READY_TO_SEND_EMAILS.md", label: "Ready Emails" },
  { file: "SIMA_PRE_IMMIGRATION_IDENTITY.md", label: "Pre-Immigration Identity" },
  { file: "SIMA_BERMAN_FAMILY_SHARE.md", label: "Family Share (EN)" },
  { file: "SIMA_BERMAN_FAMILY_SHARE_HE.md", label: "Family Share (HE)" },
  { file: "HOW_TO_CONTINUE_THIS_RESEARCH.md", label: "How to Continue" },
  { file: "TODO_ROADMAP.md", label: "TODO Roadmap" },
  { file: "FINDINGS_OVERVIEW.md", label: "Findings Overview" },
];

const searchCache = new Map();

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
  let inTable = false;

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

  function closeTable() {
    if (inTable) {
      html += "</tbody></table></div>";
      inTable = false;
    }
  }

  function splitTableRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => inlineFormat(cell.trim()));
  }

  function isDividerRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    if (!trimmed) return false;
    return trimmed
      .split("|")
      .every((part) => /^:?-{3,}:?$/.test(part.trim()));
  }

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      closeParagraph();
      closeList();
      closeTable();
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
      closeTable();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeList();
      closeTable();
      const level = heading[1].length;
      html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`;
      continue;
    }

    const nextLine = lines[i + 1]?.trimEnd() ?? "";
    if (
      line.includes("|") &&
      nextLine.includes("|") &&
      isDividerRow(nextLine)
    ) {
      closeParagraph();
      closeList();
      closeTable();
      const headers = splitTableRow(line);
      html += '<div class="table-wrap"><table class="markdown-table"><thead><tr>';
      html += headers.map((cell) => `<th>${cell}</th>`).join("");
      html += "</tr></thead><tbody>";
      inTable = true;
      i += 1;
      continue;
    }

    if (inTable && isDividerRow(line)) {
      continue;
    }

    if (inTable && line.includes("|")) {
      const cells = splitTableRow(line);
      html += "<tr>";
      html += cells.map((cell) => `<td>${cell}</td>`).join("");
      html += "</tr>";
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      closeParagraph();
      closeTable();
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
      closeTable();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineFormat(ordered[1])}</li>`;
      continue;
    }

    closeList();
    closeTable();
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
  closeTable();
  if (inCode) {
    html += "</code></pre>";
  }

  return html;
}

async function loadSingleDoc(doc, contentEl, titleEl, rawLink) {
  if (!allowedDocs.has(doc)) {
    if (titleEl) titleEl.textContent = "Document not available";
    contentEl.innerHTML = "<p>This document is not available in the web viewer.</p>";
    if (rawLink) rawLink.hidden = true;
    return;
  }

  if (titleEl) {
    titleEl.textContent = doc.replace(/\.md$/, "").replaceAll("_", " ");
  }
  if (rawLink) {
    rawLink.href = `./${doc}`;
  }

  try {
    const response = await fetch(`./${doc}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${doc}`);
    }
    const markdown = await response.text();
    contentEl.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    if (titleEl) titleEl.textContent = "Load error";
    contentEl.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function loadDocs() {
  const singleContent = document.getElementById("doc-content");
  if (singleContent) {
    const params = new URLSearchParams(window.location.search);
    const doc = params.get("doc") || "README.md";
    await loadSingleDoc(
      doc,
      singleContent,
      document.getElementById("doc-title"),
      document.getElementById("raw-link"),
    );
  }

  const multiDocNodes = document.querySelectorAll("[data-doc]");
  for (const node of multiDocNodes) {
    const doc = node.getAttribute("data-doc");
    if (doc) {
      await loadSingleDoc(doc, node);
    }
  }
}

loadDocs();

async function fetchDocText(file) {
  if (searchCache.has(file)) return searchCache.get(file);
  const promise = fetch(`./${file}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${file}`);
      return response.text();
    })
    .catch(() => "");
  searchCache.set(file, promise);
  return promise;
}

function buildSnippet(text, query) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return "";
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + query.length + 140);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

async function runSearch(query) {
  const statusEl = document.getElementById("site-search-status");
  const resultsEl = document.getElementById("site-search-results");
  if (!statusEl || !resultsEl) return;

  const trimmed = query.trim();
  if (!trimmed) {
    statusEl.textContent = "Enter a term to search across the repository documents.";
    resultsEl.innerHTML = "";
    return;
  }

  statusEl.textContent = `Searching for "${trimmed}"...`;
  resultsEl.innerHTML = "";

  const results = [];
  for (const doc of docCatalog) {
    const text = await fetchDocText(doc.file);
    if (!text) continue;
    if (text.toLowerCase().includes(trimmed.toLowerCase())) {
      results.push({
        ...doc,
        snippet: buildSnippet(text, trimmed),
      });
    }
  }

  if (!results.length) {
    statusEl.textContent = `No matches found for "${trimmed}".`;
    return;
  }

  statusEl.textContent = `Found ${results.length} matching document${results.length === 1 ? "" : "s"} for "${trimmed}".`;
  resultsEl.innerHTML = results
    .map(
      (result) => `
        <article class="search-result">
          <h3><a href="./docs.html?doc=${result.file}">${escapeHtml(result.label)}</a></h3>
          <p>${escapeHtml(result.snippet || "Match found in this document.")}</p>
        </article>
      `,
    )
    .join("");
}

const searchInput = document.getElementById("site-search-input");
const searchButton = document.getElementById("site-search-button");

if (searchInput && searchButton) {
  const triggerSearch = () => runSearch(searchInput.value);
  searchButton.addEventListener("click", triggerSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      triggerSearch();
    }
  });
  if (!document.getElementById("site-search-status")?.textContent) {
    document.getElementById("site-search-status").textContent =
      "Search names, places, archives, or surname variants across the repository.";
  }
}
