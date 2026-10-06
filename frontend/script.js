const API_BASE = "http://127.0.0.1:8000";

const state = {
    folders: [],
    selectedFolderId: null,
    selectedType: "pdf",
    currentResources: [],
    searchRequestId: 0,
};

const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const folderList = document.getElementById("folderList");
const selectedFolder = document.getElementById("selectedFolder");
const searchInput = document.getElementById("searchInput");
const statsGrid = document.getElementById("statsGrid");
const newFolderButton = document.getElementById("newFolderButton");
const pdfInput = document.getElementById("pdfInput");
const videoInput = document.getElementById("videoInput");
const imageInput = document.getElementById("imageInput");

function showToast(message) {
    let toast = document.getElementById("memora-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "memora-toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timerId);
    showToast.timerId = setTimeout(() => {
        toast.hidden = true;
    }, 2600);
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function apiFetch(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const requestOptions = { ...options };
    requestOptions.headers = new Headers(options.headers || {});

    if (!isFormData && !requestOptions.headers.has("Content-Type") && !(options.body instanceof FormData)) {
        requestOptions.headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE}${path}`, requestOptions);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
        const message = typeof data === "string" ? data : (data.detail || data.message || "Request failed.");
        throw new Error(message);
    }

    return data;
}

function typeLabel(type) {
    const labels = {
        pdf: "PDF",
        link: "Link",
        note: "Note",
        video: "Video",
        image: "Image",
    };
    return labels[type] || type;
}

async function loadDashboard() {
    try {
        const data = await apiFetch("/dashboard");
        const summary = data.summary || {};
        statsGrid.innerHTML = `
            <div class="stat-card"><span>Total Folders</span><strong>${summary.total_folders ?? 0}</strong></div>
            <div class="stat-card"><span>Total Resources</span><strong>${summary.total_resources ?? 0}</strong></div>
            <div class="stat-card"><span>PDFs</span><strong>${summary.pdfs ?? 0}</strong></div>
            <div class="stat-card"><span>Notes</span><strong>${summary.notes ?? 0}</strong></div>
            <div class="stat-card"><span>Links</span><strong>${summary.links ?? 0}</strong></div>
            <div class="stat-card"><span>Videos</span><strong>${summary.videos ?? 0}</strong></div>
            <div class="stat-card"><span>Images</span><strong>${summary.images ?? 0}</strong></div>
        `;
    } catch (error) {
        showToast(error.message || "Unable to load dashboard.");
    }
}

async function loadFolders() {
    try {
        const data = await apiFetch("/folders");
        state.folders = data.folders || [];
        renderFolderList();

        if (!state.folders.length) {
            state.selectedFolderId = null;
            renderEmptySelection();
            return;
        }

        if (!state.selectedFolderId || !state.folders.some((folder) => folder.id === state.selectedFolderId)) {
            state.selectedFolderId = state.folders[0].id;
        }

        const selectedFolderData = state.folders.find((folder) => folder.id === state.selectedFolderId);
        if (selectedFolderData) {
            renderFolderPanel(selectedFolderData);
        }
    } catch (error) {
        showToast(error.message || "Unable to load folders.");
    }
}

function renderEmptySelection() {
    selectedFolder.innerHTML = `
        <div class="empty-state">
            <h2>No folder selected</h2>
            <p>Create a new folder to start organizing your study resources.</p>
        </div>
    `;
}

function renderFolderList() {
    const query = searchInput.value.trim().toLowerCase();
    const folders = query
        ? state.folders.filter((folder) => folder.name.toLowerCase().includes(query))
        : state.folders;

    folderList.innerHTML = "";

    if (!folders.length) {
        folderList.innerHTML = '<li class="empty-resource">No matching folders</li>';
        return;
    }

    folders.forEach((folder) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `folder-item ${folder.id === state.selectedFolderId ? "active" : ""}`;
        item.innerHTML = `<span>📁</span><span>${escapeHtml(folder.name)}</span>`;
        item.addEventListener("click", () => selectFolder(folder.id));
        folderList.appendChild(item);
    });
}

function selectFolder(folderId, resourceType = "pdf") {
    if (searchInput.value) {
        searchInput.value = "";
        state.searchRequestId += 1;
    }
    if (state.selectedFolderId !== folderId) {
        state.selectedType = resourceType;
        state.currentResources = [];
    }
    state.selectedFolderId = folderId;
    const selected = state.folders.find((folder) => folder.id === folderId);
    renderFolderList();
    if (selected) {
        renderFolderPanel(selected);
    }
}

function renderFolderPanel(folder) {
    const types = [
        { key: "pdf", icon: "📄", label: "PDFs" },
        { key: "link", icon: "🔗", label: "Links" },
        { key: "note", icon: "📝", label: "Notes" },
        { key: "video", icon: "🎥", label: "Videos" },
        { key: "image", icon: "🖼️", label: "Images" },
    ];

    selectedFolder.innerHTML = `
        <div class="folder-header">
            <h2>📁 ${escapeHtml(folder.name)}</h2>
            <div class="folder-actions">
                <button type="button" class="secondary-btn" data-action="rename-folder" data-folder-id="${folder.id}">Rename</button>
                <button type="button" class="danger-btn" data-action="delete-folder" data-folder-id="${folder.id}">Delete</button>
            </div>
        </div>

        <div class="content-types">
            ${types
                .map(
                    (type) => `
                        <button
                            type="button"
                            class="content-type ${state.selectedType === type.key ? "active" : ""}"
                            data-type="${type.key}"
                        >
                            ${type.icon} ${type.label}
                        </button>
                    `
                )
                .join("")}
        </div>

        <div id="resourceList" class="resource-list"></div>
    `;

    if (!state.selectedType) {
        state.selectedType = "pdf";
    }

    loadTypeResources(state.selectedType);
}

async function loadTypeResources(type) {
    if (!state.selectedFolderId) {
        return;
    }

    state.selectedType = type;
    selectedFolder.querySelectorAll(".content-type").forEach((button) => {
        button.classList.toggle("active", button.dataset.type === type);
    });
    const resourceList = document.getElementById("resourceList");

    if (!resourceList) {
        return;
    }

    try {
        const data = await apiFetch(`/folders/${state.selectedFolderId}/resources?type=${encodeURIComponent(type)}`);
        state.currentResources = data.resources || [];
        renderResourceList();
    } catch (error) {
        resourceList.innerHTML = `<div class="empty-resource"><p>${escapeHtml(error.message || "Unable to load resources.")}</p></div>`;
    }
}

function renderResourceList() {
    const resourceList = document.getElementById("resourceList");
    if (!resourceList) {
        return;
    }

    const resources = state.currentResources;
    const addButton = `
        <div class="resource-toolbar">
            <button type="button" class="primary-btn" data-add-resource="${state.selectedType}">
                + Add ${typeLabel(state.selectedType)}
            </button>
        </div>
    `;

    if (!resources.length) {
        const typeName = typeLabel(state.selectedType);
        resourceList.innerHTML = `${addButton}
            <div class="empty-resource resource-empty">
                <p>No ${typeName.toLowerCase()} saved yet.</p>
            </div>
        `;
        return;
    }

    resourceList.innerHTML = `${addButton}${resources.map((resource) => renderResourceCard(resource)).join("")}`;
}

function renderResourceCard(resource) {
    const deleteButton = `<button type="button" class="delete-btn" data-action="delete-resource" data-resource-id="${resource.id}">Delete</button>`;

    if (resource.type === "note") {
        return `
            <article class="resource-card">
                <div class="resource-header">
                    <h3>${escapeHtml(resource.title || "Untitled Note")}</h3>
                    <div class="resource-actions">
                        <button type="button" class="secondary-btn" data-action="edit-note" data-resource-id="${resource.id}">Edit</button>
                        ${deleteButton}
                    </div>
                </div>
                <p>${escapeHtml(resource.content || "")}</p>
            </article>
        `;
    }

    if (resource.type === "link") {
        return `
            <article class="resource-card">
                <div class="resource-header">
                    <h3>${escapeHtml(resource.title || "Untitled Link")}</h3>
                    ${deleteButton}
                </div>
                <a href="${escapeHtml(resource.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(resource.url || "Open link")}</a>
            </article>
        `;
    }

    if (resource.type === "pdf") {
        return `
            <article class="resource-card">
                <div class="resource-header">
                    <h3>${escapeHtml(resource.title || resource.file_name || "PDF")}</h3>
                    ${deleteButton}
                </div>
                <a href="${resource.file_url || "#"}" target="_blank" rel="noreferrer">Open PDF</a>
                <div class="file-meta">${escapeHtml(resource.file_name || "PDF")}</div>
            </article>
        `;
    }

    if (resource.type === "image") {
        return `
            <article class="resource-card">
                <div class="resource-header">
                    <h3>${escapeHtml(resource.title || resource.file_name || "Image")}</h3>
                    ${deleteButton}
                </div>
                <img src="${resource.file_url || "#"}" alt="${escapeHtml(resource.title || resource.file_name || "Image")}">
                <div class="file-meta"><a href="${resource.file_url || "#"}" target="_blank" rel="noreferrer">Open image</a></div>
            </article>
        `;
    }

    if (resource.type === "video") {
        return `
            <article class="resource-card">
                <div class="resource-header">
                    <h3>${escapeHtml(resource.title || resource.file_name || "Video")}</h3>
                    ${deleteButton}
                </div>
                <video controls preload="metadata">
                    <source src="${resource.file_url || "#"}" type="${escapeHtml(resource.media_type || "video/mp4")}">
                    Your browser does not support video playback.
                </video>
                <div class="file-meta"><a href="${resource.file_url || "#"}" target="_blank" rel="noreferrer">Open video</a></div>
            </article>
        `;
    }

    return "";
}

function renderSearchResults(results, query) {
    const folders = results.folders || [];
    const resources = results.resources || [];
    const folderMarkup = folders.length
        ? folders
              .map(
                  (folder) => `
                    <button type="button" class="search-result folder-search-result" data-action="open-search-folder" data-folder-id="${folder.id}">
                        <span>📁 ${escapeHtml(folder.name)}</span>
                        <span class="file-meta">Open folder</span>
                    </button>
                `,
              )
              .join("")
        : '<p class="empty-resource">No matching folders.</p>';
    const resourceMarkup = resources.length
        ? resources
              .map(
                  (resource) => `
                    <article class="search-result">
                        <div>
                            <strong>${escapeHtml(resource.title || resource.file_name || "Untitled resource")}</strong>
                            <p>${escapeHtml(typeLabel(resource.type))} · ${escapeHtml(resource.folder_name || "Folder")}</p>
                        </div>
                        <button type="button" class="secondary-btn" data-action="open-search-resource" data-folder-id="${resource.folder_id}" data-resource-type="${escapeHtml(resource.type)}">Open</button>
                    </article>
                `,
              )
              .join("")
        : '<p class="empty-resource">No matching resources.</p>';

    selectedFolder.innerHTML = `
        <div class="folder-header">
            <h2>Search results</h2>
            <span class="file-meta">Results for “${escapeHtml(query)}”</span>
        </div>
        <section class="search-section">
            <h3>Folders (${folders.length})</h3>
            <div class="search-results">${folderMarkup}</div>
        </section>
        <section class="search-section">
            <h3>Resources (${resources.length})</h3>
            <div class="search-results">${resourceMarkup}</div>
        </section>
    `;
}

async function searchEverywhere(query) {
    const requestId = ++state.searchRequestId;
    try {
        const results = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
        if (requestId !== state.searchRequestId || searchInput.value.trim() !== query) {
            return;
        }
        renderSearchResults(results, query);
    } catch (error) {
        if (requestId === state.searchRequestId) {
            selectedFolder.innerHTML = `<div class="empty-state"><h2>Search unavailable</h2><p>${escapeHtml(error.message || "Unable to search resources.")}</p></div>`;
        }
    }
}

async function createFolder() {
    const name = prompt("Enter folder name:");
    if (!name || !name.trim()) {
        return;
    }

    try {
        const data = await apiFetch("/folders", {
            method: "POST",
            body: JSON.stringify({ name: name.trim() }),
        });
        showToast(data.message || "Folder created.");
        await loadFolders();
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Unable to create folder.");
    }
}

async function renameFolder(folderId) {
    const folder = state.folders.find((item) => item.id === folderId);
    if (!folder) {
        return;
    }

    const newName = prompt("Rename folder:", folder.name);
    if (!newName || !newName.trim()) {
        return;
    }

    try {
        const data = await apiFetch(`/folders/${folderId}`, {
            method: "PUT",
            body: JSON.stringify({ name: newName.trim() }),
        });
        showToast(data.message || "Folder renamed.");
        await loadFolders();
    } catch (error) {
        showToast(error.message || "Unable to rename folder.");
    }
}

async function deleteFolder(folderId) {
    const confirmed = window.confirm("Delete this folder and all its resources?");
    if (!confirmed) {
        return;
    }

    try {
        const data = await apiFetch(`/folders/${folderId}`, {
            method: "DELETE",
        });
        showToast(data.message || "Folder deleted.");
        await loadFolders();
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Unable to delete folder.");
    }
}

async function deleteResource(resourceId) {
    const confirmed = window.confirm("Delete this resource?");
    if (!confirmed) {
        return;
    }

    try {
        const data = await apiFetch(`/resources/${resourceId}`, {
            method: "DELETE",
        });
        showToast(data.message || "Resource deleted.");
        await loadTypeResources(state.selectedType);
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Unable to delete resource.");
    }
}

function renderNoteForm(note = null) {
    state.selectedType = "note";
    selectedFolder.querySelectorAll(".content-type").forEach((button) => {
        button.classList.toggle("active", button.dataset.type === "note");
    });

    const resourceList = document.getElementById("resourceList");
    if (!resourceList) {
        return;
    }

    resourceList.innerHTML = `
        <form id="noteForm" class="resource-form">
            <h3>${note ? "Edit note" : "New note"}</h3>
            <label for="noteTitle">Title</label>
            <input id="noteTitle" name="title" maxlength="200" required value="${escapeHtml(note?.title || "")}" placeholder="e.g. Exam preparation">
            <label for="noteContent">Note</label>
            <textarea id="noteContent" name="content" required placeholder="Write your note...">${escapeHtml(note?.content || "")}</textarea>
            <div class="form-actions">
                <button type="submit" class="primary-btn">${note ? "Save changes" : "Save note"}</button>
                <button type="button" class="secondary-btn" data-action="cancel-note">Cancel</button>
            </div>
            ${note ? `<input type="hidden" name="resource_id" value="${note.id}">` : ""}
        </form>
    `;
    document.getElementById("noteTitle").focus();
}

async function saveNote(form) {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const resourceId = String(formData.get("resource_id") || "");

    if (!title || !content) {
        showToast("Enter both a note title and note content.");
        return;
    }

    try {
        const response = await apiFetch(
            resourceId ? `/resources/${resourceId}` : `/folders/${state.selectedFolderId}/resources`,
            {
                method: resourceId ? "PUT" : "POST",
                body: JSON.stringify(
                    resourceId
                        ? { title, content }
                        : { type: "note", title, content },
                ),
            },
        );
        showToast(response.message || "Note saved.");
        await loadTypeResources("note");
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Unable to save note.");
    }
}

function editNote(resourceId) {
    const note = state.currentResources.find((resource) => resource.id === resourceId);
    if (note?.type === "note") {
        renderNoteForm(note);
    }
}

async function addLink() {
    const url = prompt("Enter a valid http:// or https:// URL:");
    if (!url || !url.trim()) {
        return;
    }

    try {
        const parsedUrl = new URL(url.trim());
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("URL must use HTTP or HTTPS.");
        }
        const title = prompt("Link title:", parsedUrl.hostname) || parsedUrl.hostname;
        const response = await apiFetch(`/folders/${state.selectedFolderId}/resources`, {
            method: "POST",
            body: JSON.stringify({
                type: "link",
                title: title.trim() || parsedUrl.hostname,
                url: url.trim(),
            }),
        });
        showToast(response.message || "Link saved.");
        await loadTypeResources("link");
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Please enter a valid HTTP/HTTPS URL.");
    }
}

async function handleFileUpload(type, file) {
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

    try {
        const response = await fetch(`${API_BASE}/folders/${state.selectedFolderId}/resources/upload`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.message || "Upload failed.");
        }

        showToast(data.message || "Upload successful.");
        await loadTypeResources(type);
        await loadDashboard();
    } catch (error) {
        showToast(error.message || "Upload failed.");
    } finally {
        pdfInput.value = "";
        videoInput.value = "";
        imageInput.value = "";
    }
}

function openResourceForm(type) {
    if (type === "note") {
        renderNoteForm();
        return;
    }

    if (type === "link") {
        addLink();
        return;
    }

    if (type === "pdf") {
        pdfInput.click();
        return;
    }

    if (type === "video") {
        videoInput.click();
        return;
    }

    if (type === "image") {
        imageInput.click();
    }
}

menuButton.addEventListener("click", () => {
    sidebar.classList.toggle("hidden");
});

newFolderButton.addEventListener("click", createFolder);

searchInput.addEventListener("input", () => {
    renderFolderList();
    const query = searchInput.value.trim();
    state.searchRequestId += 1;
    if (query) {
        searchEverywhere(query);
        return;
    }

    const selected = state.folders.find((folder) => folder.id === state.selectedFolderId);
    if (selected) {
        renderFolderPanel(selected);
    } else {
        renderEmptySelection();
    }
});

pdfInput.addEventListener("change", (event) => {
    handleFileUpload("pdf", event.target.files[0]);
});

videoInput.addEventListener("change", (event) => {
    handleFileUpload("video", event.target.files[0]);
});

imageInput.addEventListener("change", (event) => {
    handleFileUpload("image", event.target.files[0]);
});

document.addEventListener("click", async (event) => {
    const typeButton = event.target.closest("[data-type]");
    if (typeButton) {
        await loadTypeResources(typeButton.dataset.type);
        return;
    }

    const addButton = event.target.closest("[data-add-resource]");
    if (addButton) {
        openResourceForm(addButton.dataset.addResource);
        return;
    }

    const renameButton = event.target.closest("[data-action='rename-folder']");
    if (renameButton) {
        await renameFolder(Number(renameButton.dataset.folderId));
        return;
    }

    const deleteFolderButton = event.target.closest("[data-action='delete-folder']");
    if (deleteFolderButton) {
        await deleteFolder(Number(deleteFolderButton.dataset.folderId));
        return;
    }

    const deleteResourceButton = event.target.closest("[data-action='delete-resource']");
    if (deleteResourceButton) {
        await deleteResource(Number(deleteResourceButton.dataset.resourceId));
        return;
    }

    const editNoteButton = event.target.closest("[data-action='edit-note']");
    if (editNoteButton) {
        editNote(Number(editNoteButton.dataset.resourceId));
        return;
    }

    const cancelNoteButton = event.target.closest("[data-action='cancel-note']");
    if (cancelNoteButton) {
        await loadTypeResources("note");
        return;
    }

    const openFolderButton = event.target.closest("[data-action='open-search-folder']");
    if (openFolderButton) {
        searchInput.value = "";
        selectFolder(Number(openFolderButton.dataset.folderId));
        return;
    }

    const openResourceButton = event.target.closest("[data-action='open-search-resource']");
    if (openResourceButton) {
        searchInput.value = "";
        const folderId = Number(openResourceButton.dataset.folderId);
        if (state.selectedFolderId !== folderId) {
            state.selectedType = openResourceButton.dataset.resourceType;
        }
        selectFolder(folderId, openResourceButton.dataset.resourceType);
        await loadTypeResources(openResourceButton.dataset.resourceType);
    }
});

document.addEventListener("submit", async (event) => {
    if (event.target.matches("#noteForm")) {
        event.preventDefault();
        await saveNote(event.target);
    }
});

async function init() {
    await loadDashboard();
    await loadFolders();
}

init();
