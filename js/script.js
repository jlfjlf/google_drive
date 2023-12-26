/*
************************************ TODOs ************************************
1) make sure window.gapiLoaded, window.listFiles, etc. are safe as global window functions. Separating sensetive data to config.js caused problems without these.

*/

/* exported gapiLoaded */
/* exported gisLoaded */
/* exported handleAuthClick */
/* exported handleSignoutClick */

// Set to client ID and API key from the Developer Console
import { CLIENT_ID, API_KEY } from '../config.js';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

document.getElementById('authorize_button').style.visibility = 'hidden';
document.getElementById('signout_button').style.visibility = 'hidden';

/**
 * Callback after api.js is loaded.
 */
// window.gapiLoaded = function gapiLoaded() {
//     gapi.load('client', initializeGapiClient);
// }

// Callback after api.js is loaded.
window.gapiLoaded = function () {                   // Changed '= function gapiLoaded()' to '= function ()' to fix ramdom loading error
    gapi.load('client', initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
window.gisLoaded = function () {                   // Changed '= gisloaded()' to '= ()' to fix ramdom loading error
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize_button').style.visibility = 'visible';
    }
}

/**
 *  Sign in the user upon button click.
 */

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
        throw (resp);
        }
        document.getElementById('signout_button').style.visibility = 'visible';
        document.getElementById('authorize_button').innerText = 'Refresh';
        await listFiles();
    };

    if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account and ask for consent to share their data
        // when establishing a new session.
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
    }
}
window.handleAuthClick = handleAuthClick;   // Made global (window.) to make function accessible from html after moving to things to config.js

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        document.getElementById('content').innerText = '';
        document.getElementById('authorize_button').innerText = 'Authorize';
        document.getElementById('signout_button').style.visibility = 'hidden';
    }
}
window.handleSignoutClick = handleSignoutClick; // Made global (window.) to make function accessible from html after moving to things to config.js


/**
 * Print metadata for first 'numFiles' or default to 10 files.
 */
async function listFiles(numFiles = 10) {
    console.log('Listing files...');
    let response;
    try {
        response = await gapi.client.drive.files.list({
        'pageSize': numFiles,
        'fields': 'files(id, name)',
        });
    } catch (err) {
        document.getElementById('content').innerText = err.message;
        return;
    }
    const files = response.result.files;
    if (!files || files.length == 0) {
        document.getElementById('content').innerText = 'No files found.';
        return;
    }
    // Flatten to string to display
    const output = files.reduce(
        (str, file) => `${str}${file.name} (${file.id})\n`,
        'Files:\n');
    document.getElementById('content').innerText = output;
};
window.listFiles = listFiles;   // Made global (window.) to make function accessible from html after moving to things to config.js


// *********************** Create folder ***********************
// ----- Root folder only for now -----
async function createFolder(folderName) {
    try {
        // Check if folder already exists
        let response = await gapi.client.drive.files.list({
            'q': `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
            'fields': 'files(id, name)'
        }); 
        if (response.result.files.length > 0) {
            console.log('Folder already exists');
            return;
        }

        // Create folder if it doesn't exist
        response = await gapi.client.drive.files.create({
            resource: {
                'name': folderName,
                'mimeType': 'application/vnd.google-apps.folder'
            },
            'fields': 'id'
        });

        console.log('Folder Id: ', response.result.id);
    } catch (err) {
        console.error(err);
    }
}
window.createFolder = createFolder;  // Made global (window.) to make function accessible from html after moving to things to config.js


// *********************** Delete File ***********************
function deleteFile(fileId) {
    return gapi.client.drive.files.delete({
        'fileId': fileId
    })
    .then(function(response) {
        // Handle the results here (response.result has the parsed body).
        console.log("File deleted successfully", response);
    },
    function(err) { 
        console.error("Execute error", err); 
    });
}
window.deleteFile = deleteFile;


// *********************** Get Folder Id ***********************  
async function getFolderID(folderName) {
    try {
        let response = await gapi.client.drive.files.list({
            'q': `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
            'fields': 'files(id, name)'
        });

        if (response.result.files.length > 0) {
            console.log('Folder ID: ', response.result.files[0].id);
            return response.result.files[0].id;
        } else {
            console.log(`The folder: ${folderName} does not exist`);
            return null;
        }
    } catch (err) {
        console.error(err);
    }
};


// *********************** Upload File ***********************
// --- Set folderName to 'root' for root folder ---
async function uploadFile(file, folderName) {
        // Check if folder exists
        let folderID = await getFolderID(folderName);
        console.log("Here: " + file.name, file.type, folderID);
        if (folderID === null) {
            console.log(`Folder: ${folderName} does not exist`);
            return;
        }

    const boundary = '-------314159265358979323846'; 
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
  
    const metadata = {
        name: file.name,
        parents: [folderID]
    };
  
    const fileData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(btoa(reader.result)); 
        reader.readAsBinaryString(file);
    });
  
    const multipartRequestBody = 
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + file.type + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        fileData +
        close_delim;
  
    await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: {'uploadType': 'multipart'},
        headers: {'Content-Type': 'multipart/related; boundary="' + boundary + '"'},
        body: multipartRequestBody  
    });
}


// *********************** Get Upload Files List ***********************
function getUploadFilesList() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = (e) => {
            resolve([...e.target.files]);
        };
        input.onerror = (e) => {
            reject(e);
        };
        input.click();
    });
}


// *********************** Upload Files ***********************
async function uploadSelectedFiles(folderName = 'whatever') {
    folderName = 'whatever';
    console.log('Try Uploading files...');
    try {
        const files = await getUploadFilesList();
        for (const file of files) {
            await uploadFile(file, folderName);
        }
    } catch (err) {
        console.error(err);
    }
}


// *********************** Get Local Files to Upload ***********************  
function getLocalFilesList() {
    getUploadFilesList().then(files => {
        console.log(files); // This will log an array of File objects
        return files;     // This will return a Promise of an array of File objects
    }).catch(err => {
        console.error(err);
    });

}

// // *********************** Get Upload List and Upload Files ***********************
// // UNUSED!!!
// function getAndUploadFiles() {
//     // Create dialog and get files list
//     const uploadList = getLocalFilesList();
//     console.log('Upload List: ');
//     // Upload files
//     };


const btnUploadEl = document.getElementById('btn_upload_file');
btnUploadEl.addEventListener('click', uploadSelectedFiles);



// *********************** Test loader ***********************    
let myFile;
function readFile(input) {
    let file = input.files[0];
    let reader = new FileReader();

    reader.readAsText(file);
    reader.onload = function() {
        console.log(reader.result);
    };
    reader.onerror = function() {
        console.log(reader.error);
    };
};
window.readFile = readFile;

