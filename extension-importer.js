const DB_NAME = "ZincExtensions";
const STORE_NAME = "extensions";

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME, {
                keyPath: "id"
            });
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);
    });
}

async function fileToText(file) {
    return await file.text();
}

async function fileToBase64(file) {
    return await new Promise(resolve => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.readAsDataURL(file);
    });
}

async function importExtension(files) {

    let manifest = null;

    const extension = {
        id: "",
        manifest: null,
        files: {}
    };

    for (const file of files) {

        const path = file.webkitRelativePath.split("/").slice(1).join("/");

        if (path === "manifest.json") {

            manifest = JSON.parse(await file.text());

            extension.manifest = manifest;
            extension.id = manifest.id;

        }

        if (
            file.type.startsWith("image/")
        ) {

            extension.files[path] = {
                type: file.type,
                data: await fileToBase64(file)
            };

        } else {

            extension.files[path] = {
                type: file.type || "text/plain",
                data: await fileToText(file)
            };

        }

    }

    if (!manifest)
        throw new Error("manifest.json not found");

    if (!manifest.id)
        throw new Error("Extension id missing");

    const db = await openDB();

    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(extension);

    return new Promise(resolve => {

        tx.oncomplete = () => {
            console.log("Installed:", manifest.name);
            resolve(extension);
        };

    });

}

document
.getElementById("folderPicker")
.addEventListener("change", async e => {

    try {

        await importExtension(e.target.files);

        alert("Extension installed!");

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

});
