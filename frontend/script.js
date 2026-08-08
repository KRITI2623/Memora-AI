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
