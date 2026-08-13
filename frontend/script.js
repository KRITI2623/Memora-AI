const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");

menuButton.addEventListener("click", function () {
    sidebar.classList.toggle("hidden");
});
const newFolderButton = document.getElementById("newFolderButton");
const folderList = document.getElementById("folderList");

newFolderButton.addEventListener("click", function () {
    const folderName = prompt("Enter Folder Name :");
    if (folderName) {
        const newFolder = document.createElement("li");
        newFolder.textContent = "📁 " + folderName;
        folderList.appendChild(newFolder);
    }
});
const selectedFolder = document.getElementById("selectedFolder");

folderList.addEventListener("click", function (event) {
    if (event.target.tagName === "LI") {
        const folderName = event.target.textContent.replace("📁 ", "");

        selectedFolder.innerHTML = `
            <h2>${folderName}</h2>

            <div class="content-types">
                <div class = "content-type" id = "pdfs">📄 PDFs</div>
                <div class = "content-type" id = "links">🔗 Links</div>
                <div class = "content-type" id = "notes">📝 Notes</div>
                <div class = "content-type" id = "videos">🎥 Videos</div>
                <div class = "content-type" id = "images">🖼️ Images</div>
            </div>
    `;
    }
});
selectedFolder.addEventListener("click", function (event) {
    if (event.target.classList.contains("content-type")) {
        const contentType = event.target.textContent;
        if (contentType.includes("PDFs")) {
            selectedFolder.innerHTML = `
            <h2>📄 PDFs</h2>
            <p>No PDFs saved yet.</p>
            <button id = "addPdfButton">+ Add PDF</button>
            `;
        } else if (contentType.includes("Links")) {
            selectedFolder.innerHTML = `
            <h2>🔗 Links</h2>
            <p>No links saved yet.</p>
            <button id = "addLinkButton">+ Add Link</button>
            `;
        } else if (contentType.includes("Links")) {
            selectedFolder.innerHTML = `
            <h2>🔗 Links</h2>
            <p>No Links saved yet.</p>
            <button id = "addLinkButton">+Add Link</button>
            `;
        } else if (contentType.includes("Notes")) {
            selectedFolder.innerHTML = `
            <h2>📝 Notes</h2>
            <p>No notes saved yet.</p>
            <button id = "addNoteButton">+ Add Note</button>
            `;
        }
        else if (contentType.includes("Videos")) {
            selectedFolder.innerHTML = `
            <h2>🎥 Videos</h2>
            <p>No videos saved yet.</p>
            <button id ="addVideoButton">+ Add Video</button>
            `;
        } else {
            alert("You clicked: " + contentType);
        }
    }
});
document.addEventListener("click", function (event) {
    if (event.target.id === "addPdfButton") {
        document.getElementById("pdfInput").click();
    }
});
const pdfInput = document.getElementById("pdfInput");
pdfInput.addEventListener("change", function () {
    const file = pdfInput.files[0];
    if (file) {
        const pdfList = document.createElement("div");
        pdfList.className = "pdf-item";
        pdfList.textContent = "📄 " + file.name;
        pdfList.style.cursor = "pointer";
        pdfList.addEventListener("click", function () {
            const pdfURL = URL.createObjectURL(file);
            window.open(pdfURL, "_blank");
        });
        document.getElementById("addPdfButton").before(pdfList);
    }
});
document.addEventListener("click", function (event) {
    if (event.target.id === "addLinkButton") {
        const linkURL = prompt("Enter ebsite URL");
        if (linkURL) {
            const linkItem = document.createElement("div");
            linkItem.className = "link-item";
            linkItem.textContent = "🔗 " + linkURL;
            linkItem.style.cursor = "pointer";
            linkItem.addEventListener("click", function () {
                window.open(linkURL, "_blank");
            });
            document.getElementById("addLinkButton").before(linkItem);
        }
    }
});
document.addEventListener("click", function (event) {
    if (event.target.id === "addNoteButton") {
        selectedFolder.innerHTML = `
        <h2>📝 New Note</h2>
        <input
            type = "text"
            id = "noteTitle"
            placeholder="Enter note title..."
        >
        <textarea
            id = "noteContent"
            placeholder = "Write your note here..."
        ></textarea>
        <br>
        <button id = "saveNoteButton">Save Note</button>
        `;
    }
});
document.addEventListener("click", function (event) {
    if (event.target.id === "saveNoteButton") {
        const title = document.getElementById("noteTitle").value;
        const content = document.getElementById("noteContent").value;
        if (title && content) {
            selectedFolder.innerHTML = `
            <h2>📝 Notes</h2>
            <div class = "note-item">
                <h3>${title}</h3>
                <p>${content}</p>
                </div>
                <button id= "addNoteButton">+ Add Note </button>
                `;
        } else {
            alert("Please enter both a title and note.");
        }
    }
});
document.addEventListener("click", function (event) {
    if (event.target.id === "addVideoButton") {
        document.getElementById("videoInput").click();
    }
});
const videoInput = document.getElementById("videoInput");
videoInput.addEventListener("change", function () {
    const file = videoInput.files[0];
    if (file) {
        const videoURL = URL.createObjectURL(file);
        const videoItem = document.createElement("div");
        videoItem.className = "video-item";
        videoItem.innerHTML = `
        <h3>🎥 ${file.name}</h3>
        <video controls width ="400">
            <source src = "${videoURL}" type="${file.type}">
            Your browser does not support this video.
        </video>
        `;
        document.getElementById("addVideoButton").before(videoItem);
    }
});