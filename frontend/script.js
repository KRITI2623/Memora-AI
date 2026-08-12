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
const contentTypes = document.querySelectorAll(".content-type");
contentTypes.forEach(function (type) {
    type.addEventListener("click", function () {
        alert("You clicked: " + type.textContent);
    });
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
