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
                <div class = "content-type">📄 PDFs</div>
                <div class = "content-type">🔗 Links</div>
                <div class = "content-type">📝 Notes</div>
                <div class = "content-type">🎥 Videos</div>
                <div class = "content-type">🖼️ Images</div>
            </div>
    `;
    }
});