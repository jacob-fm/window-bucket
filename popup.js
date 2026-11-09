const STORAGE_KEY = "buckets";

const els = {
  form: document.getElementById("save-form"),
  name: document.getElementById("bucket-name"),
  tabCount: document.getElementById("tab-count"),
  list: document.getElementById("bucket-list"),
  empty: document.getElementById("empty"),
  template: document.getElementById("bucket-template"),
};

async function getBuckets() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] ?? [];
}

async function setBuckets(buckets) {
  await chrome.storage.local.set({ [STORAGE_KEY]: buckets });
}

function defaultName() {
  return new Date().toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// Tabs that can't be meaningfully reopened (e.g. a blank new tab page).
function isRestorable(url) {
  return url && url !== "chrome://newtab/" && url !== "about:blank" && url !== "about:newtab";
}

async function saveCurrentWindow(closeAfter) {
  const win = await chrome.windows.getCurrent({ populate: true });
  const tabs = win.tabs
    .filter((t) => isRestorable(t.url || t.pendingUrl))
    .map((t) => ({
      url: t.url || t.pendingUrl,
      title: t.title || t.url,
      pinned: t.pinned,
      favIconUrl: t.favIconUrl || "",
    }));

  if (tabs.length === 0) {
    els.tabCount.textContent = "Nothing to save";
    return;
  }

  const bucket = {
    id: crypto.randomUUID(),
    name: els.name.value.trim() || defaultName(),
    createdAt: Date.now(),
    tabs,
  };

  const buckets = await getBuckets();
  buckets.unshift(bucket);
  await setBuckets(buckets);

  if (closeAfter) {
    // Closing the window also closes this popup, so this must be last.
    await chrome.windows.remove(win.id);
  } else {
    els.name.value = "";
    render();
  }
}

async function restoreBucket(bucket) {
  const [first, ...rest] = bucket.tabs;
  const win = await chrome.windows.create({ url: first.url, focused: true });
  const firstTabId = win.tabs[0].id;
  if (first.pinned) await chrome.tabs.update(firstTabId, { pinned: true });

  for (const tab of rest) {
    try {
      await chrome.tabs.create({ windowId: win.id, url: tab.url, pinned: tab.pinned, active: false });
    } catch (err) {
      // Some URLs (e.g. other extensions' pages, privileged chrome:// pages) can't be opened.
      console.warn("Could not restore tab", tab.url, err);
    }
  }
  await chrome.tabs.update(firstTabId, { active: true });
}

async function deleteBucket(id) {
  const buckets = await getBuckets();
  await setBuckets(buckets.filter((b) => b.id !== id));
  render();
}

async function renameBucket(id, name) {
  const buckets = await getBuckets();
  const bucket = buckets.find((b) => b.id === id);
  if (!bucket || !name) return;
  bucket.name = name;
  await setBuckets(buckets);
}

function faviconFor(tab) {
  if (tab.favIconUrl && /^https?:|^data:/.test(tab.favIconUrl)) return tab.favIconUrl;
  return "icons/icon16.png";
}

function renderBucket(bucket) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const nameEl = node.querySelector(".bucket-name");
  const tabList = node.querySelector(".tab-list");
  const toggle = node.querySelector(".toggle");

  nameEl.textContent = bucket.name;
  nameEl.title = "Double-click to rename";
  node.querySelector(".bucket-meta").textContent =
    `${bucket.tabs.length} tab${bucket.tabs.length === 1 ? "" : "s"} · ${new Date(bucket.createdAt).toLocaleDateString()}`;

  for (const tab of bucket.tabs) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = faviconFor(tab);
    img.alt = "";
    img.onerror = () => { img.src = "icons/icon16.png"; };
    const a = document.createElement("a");
    a.href = tab.url;
    a.textContent = tab.title;
    a.title = tab.url;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: tab.url });
    });
    li.append(img, a);
    tabList.append(li);
  }

  toggle.addEventListener("click", () => {
    tabList.hidden = !tabList.hidden;
    toggle.classList.toggle("open", !tabList.hidden);
  });

  node.querySelector(".restore").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    await restoreBucket(bucket);
    window.close();
  });

  node.querySelector(".delete").addEventListener("click", () => {
    if (node.dataset.confirm) {
      deleteBucket(bucket.id);
    } else {
      // Two-click delete instead of confirm(), which is unreliable in popups.
      node.dataset.confirm = "1";
      const btn = node.querySelector(".delete");
      btn.textContent = "Delete?";
      btn.style.color = "var(--danger)";
      setTimeout(() => {
        delete node.dataset.confirm;
        btn.textContent = "✕";
        btn.style.color = "";
      }, 2500);
    }
  });

  nameEl.addEventListener("dblclick", () => {
    nameEl.contentEditable = "true";
    nameEl.focus();
    document.getSelection().selectAllChildren(nameEl);
  });
  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
    if (e.key === "Escape") { nameEl.textContent = bucket.name; nameEl.blur(); }
  });
  nameEl.addEventListener("blur", () => {
    nameEl.contentEditable = "false";
    const name = nameEl.textContent.trim();
    if (name && name !== bucket.name) {
      bucket.name = name;
      renameBucket(bucket.id, name);
    } else {
      nameEl.textContent = bucket.name;
    }
  });

  return node;
}

async function render() {
  const buckets = await getBuckets();
  els.list.replaceChildren(...buckets.map(renderBucket));
  els.empty.hidden = buckets.length > 0;
}

async function init() {
  const win = await chrome.windows.getCurrent({ populate: true });
  const count = win.tabs.filter((t) => isRestorable(t.url || t.pendingUrl)).length;
  els.tabCount.textContent = `${count} tab${count === 1 ? "" : "s"} in this window`;
  els.name.placeholder = `Bucket name (default: ${defaultName()})`;
  els.name.focus();

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const closeAfter = e.submitter?.dataset.close !== "false";
    saveCurrentWindow(closeAfter);
  });

  render();
}

init();
