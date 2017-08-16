/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var findOrCreateSyncGroup = function() {
    var sync, syncQuery = P.db.sync.select().order("created",true).limit(1).stableOrder().limit(1);
    if(syncQuery.length === 0 || syncQuery[0].status >= P.SYNC_STATUS.complete) {
        sync = P.db.sync.create({
            status: P.SYNC_STATUS.uploading,
            created: new Date(),
            filesJSON: "{}"
        });
    } else {
        sync = syncQuery[0];
    }
    return sync;
};

P.respond("POST", "/api/haplo-user-sync/upload-file", [
    {parameter: "name", as:"string", validate:/^[a-z0-9A-Z_\-]+$/},
    {parameter: "file", as:"file"}
], function(E, name, uploadedFile) {
    var impl = P.getImplementation();
    // Find or create a new sync group
    var sync = findOrCreateSyncGroup();
    if(sync.status !== P.SYNC_STATUS.uploading) {
        E.response.kind = 'text';
        E.response.body = 'Sync in unexpected state -- use admin interface to resolve.';
        E.response.statusCode = HTTP.BAD_REQUEST;
        return;
    }

    // Store file and file info
    var file = O.file(uploadedFile);
    var files = sync.files;
    files[name] = {
        digest: file.digest,
        fileSize: file.fileSize,
        filename: file.filename
    };
    sync.filesJSON = JSON.stringify(files);
    if(impl.allFilesUploaded(files)) { sync.status = P.SYNC_STATUS.ready; }
    sync.save();
    E.response.kind = 'json';
    E.response.body = JSON.stringify(sync.files[name], undefined, 2);
});

// --------------------------------------------------------------------------------------------------

var fetchFilesFromInstitutionalServices = function() {
    // Find or create a new sync group
    var sync = findOrCreateSyncGroup();
    if(sync.status !== P.SYNC_STATUS.uploading) {
        return;
    }
    // So the sync shows in the UI while the files are being fetched
    sync.save();

    O.background.run("haplo_user_sync:fetch_files", {});
    return true;
};

P.implementService("haplo_user_sync:fetch_files", function() {
    fetchFilesFromInstitutionalServices();
});

P.respond("POST", "/api/haplo-user-sync/fetch-files", [
], function(E) {
    if(!fetchFilesFromInstitutionalServices()) {
        E.response.kind = 'text';
        E.response.body = 'Sync in unexpected state -- use admin interface to resolve.';
        E.response.statusCode = HTTP.BAD_REQUEST;
    } else {
        E.response.kind = 'text';
        E.response.body = 'Background process started to fetch sync files from institutional services.';
        E.response.statusCode = HTTP.OK;
    }
});

P.backgroundCallback("fetch_files", function() {
    var impl = P.getImplementation();
    // Find or create a new sync group
    var sync = findOrCreateSyncGroup();
    var fetchedFiles = impl.fetchFilesFromServices();
    var files = sync.files;
    _.each(fetchedFiles, function(ff, name) {
        var file = O.file(ff);
        files[name] = {
            digest: file.digest,
            fileSize: file.fileSize,
            filename: file.filename
        };
    });
    sync.filesJSON = JSON.stringify(files);
    if(impl.allFilesUploaded(files)) { sync.status = P.SYNC_STATUS.ready; }
    sync.save();
});

// --------------------------------------------------------------------------------------------------

// Files must have a <10% change in size to be auto-applied
var MAX_OK_SIZE_RATIO = 1.1;

var unsafeFileSizeDifference = function(current, previous) {
    // First sync must be manually applied
    if(!previous) { return true; }
    var unsafe = false;
    _.each(current.files, function(digest, name) {
        var c = O.file(digest);
        if(!(name in previous.files)) {
            unsafe = true;
        } else {
            var p = O.file(previous.files[name]);
            if((c.fileSize > MAX_OK_SIZE_RATIO*p.fileSize) ||
                    (p.fileSize > MAX_OK_SIZE_RATIO*c.fileSize)) {
                unsafe = true;
            }
        }
    });
    return unsafe;
};

var startSync = function() {
    var status;
    var syncQuery = P.db.sync.select().order("created",true).limit(2); // Most recent 2 sync groups
    if(syncQuery.length === 0 || syncQuery[0].status !== P.SYNC_STATUS.ready) {
        status = "unready";
    } else {
        if(P.data.config.autoApply) {
            if(unsafeFileSizeDifference(syncQuery[0], syncQuery[1])) {
                status = "unsafe";
            } else {
                P.applySync(syncQuery[0]);
                status = "ok";
            }
        } else {
            status = "disabled";
        }
    }
    return status;
};

P.implementService("haplo_user_sync:start_sync", function() {
    return startSync();
});

P.respond("POST", "/api/haplo-user-sync/start-sync", [
], function(E) {
    var startStatus = startSync();
    E.response.kind = 'text';
    switch(startStatus) {
        case "ok":
            E.response.body = 'OK: Sync queued.';
            break;
        case "disabled":
            E.response.body = 'OK: Auto apply disabled; must apply manually.';
            break;
        case "unready":
            E.response.body = 'Last sync is not ready. Upload all the required files.';
            E.response.statusCode = HTTP.BAD_REQUEST;
            break;
        case "unsafe":
            E.response.body = 'OK: Files uploaded are too different to previous sync; must apply manually.';
            break;
        default:
            E.response.body = "Error: sync start signal returned unknown status.";
            E.response.statusCode = HTTP.INTERNAL_SERVER_ERROR;
            break;
    }
});

// --------------------------------------------------------------------------------------------------

// Used by VRE/legacy user syncs to upload files using an old method
P.implementService("haplo_user_sync:backwards_compatible_sync", function(dataFile, filename) {
    var impl = P.getImplementation();
    // Find or create a new sync group
    var sync = P.db.sync.create({
        created: new Date(),
        filesJSON: '{}'
    });

    // Store file and stuff
    var files = sync.getFiles();
    var file = O.file(dataFile);
    files[filename] = {
        digest: file.digest,
        fileSize: file.fileSize,
        filename: file.filename
    };
    sync.filesJSON = JSON.stringify(files);
    sync.status = P.SYNC_STATUS.ready;
    sync.save();

    if(P.data.config.autoApply) {
        P.applySync(sync);
    }
});

