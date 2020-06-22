/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(P.canUserAdministrateSync)) {
        response.reports.push(["/do/haplo-user-sync/admin", "User sync administration"]);
    }
});

// If the haplo_integration plugin is installed, add a link to the user sync admin to the list of integrations
P.implementService("haplo:integration:admin-ui:add-options", function(options) {
    options.push({
        action: "/do/haplo-user-sync/admin",
        label: "User sync",
        notes: "Configure user sync and view sync logs.",
        indicator: "standard"
    });
});

// --------------------------------------------------------------------------------------------------

const SHOW_EDIT_ACCESS_CONTROL = O.application.config["haplo_user_sync:show_edit_access_control"] || false;

// Add UI to user page in system management to prevent 'accidental' modifications
P.hook('hUserAdminUserInterface', function(response, user) {
    var userQuery = P.db.users.select().where("userId","=",user.id);
    if(userQuery.length === 0) { return; }  // Not managed by user sync
    var info = userQuery[0];
    response.information.push([null, "This user is managed by the user sync and should not be changed."]);
    response.information.push([null, "Username: "+info.username]);
    if(info.inFeed === false) {
        response.information.push([null, "This user cannot log in because their information does not appear in the user feed."]);
    }
    if(O.currentUser.allowed(P.canUserAdministrateSync)) {
        response.information.push(["/do/haplo-user-sync/admin/user-info?lookup="+info.username, "View sync status..."]);
    }
    // Prevent everyone other than SUPPORT from using the admin UI 
    if(!O.currentUser.isSuperUser && !SHOW_EDIT_ACCESS_CONTROL) {
        response.showEditAccessControl = false;
    }
});

// --------------------------------------------------------------------------------------------------

var configForm = P.form("config", "form/config.json");

P.onLoad = function() {
    if(!P.data.config) {
        P.data.config = {
            autoApply: true,
            updateAll: false
        };
    }
};

// --------------------------------------------------------------------------------------------------

P.respond("GET", "/do/haplo-user-sync/admin", [
    {parameter:"s", as:"int", optional:true}
], function(E, lastSyncTime) {
    var impl = P.getImplementation();
    var syncs = P.db.sync.select().order("created",true).limit(10);
    if(lastSyncTime) {
        syncs.where("created","<",new Date(lastSyncTime));
    }
    E.render({
        syncs: _.map(syncs, function(sync) {
            return {
                sync:sync,
                syncStatusText: P.STATUS_TEXT[sync.status]
            };
        }),
        implAdminUIHTML: impl.adminUI(),
        config: configForm.instance(P.data.config || {}),
        haveMappings: P.haveMappings(),
        lastSyncTime: (syncs.length > 0) ? (syncs[syncs.length - 1].created.getTime()) : 0,
        overridesEnabled: O.application.config['haplo_user_sync:enable_detail_override']
    });
});

// --------------------------------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-user-sync/admin/config", [
], function(E) {
    var document = P.data.config || {};
    var form = configForm.handle(document, E.request);
    if(form.complete) {
        P.data.config = document;
        E.response.redirect("/do/haplo-user-sync/admin");
    } else {
        E.render({
            form: form
        });
    }
});

// --------------------------------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-user-sync/admin/create-api-key", [
], function(E) {
    if(E.request.method === "POST") {
        return E.render({
            key: O.serviceUser("haplo:service-user:user-sync:access").
                    createAPIKey("User Sync", "/api/haplo-user-sync/")
        });
    }
    E.render({
        text: "Create new API key for user sync file uploader scripts?",
        options: [{label:"Create API key"}]
    });
});

// --------------------------------------------------------------------------------------------------

P.respond("GET", "/do/haplo-user-sync/admin/user-info", [
    {parameter:"lookup", as:"string", optional:true}
], function(E, lookup) {
    lookup = (lookup || '').toLowerCase().replace(/\s+/,'');
    var q, row, user, json;
    if(lookup) {
        if(-1 !== lookup.indexOf("@")) {
            // By email
            var userLookup = O.user(lookup);
            if(userLookup) {
                q = P.db.users.select().where("userId","=",userLookup.id).limit(1);
            }
        } else {
            // By username
            q = P.db.users.select().where("username","=",lookup).limit(1);
        }
        if(q && q.length === 1) {
            row = q[0];
        }
        if(row) {
            user = O.user(row.userId);
            var lastq = P.db.lastUserData.select().where("userId","=",row.userId).limit(1);
            if(lastq.length === 1) {
                json = JSON.stringify(JSON.parse(lastq[0].json), undefined, 2);
            }
        }
    }
    E.render({
        backLink: "/do/haplo-user-sync/admin",
        lookup: lookup,
        row: row,
        user: user,
        json: json,
        userCannotLoginBecauseNotInFeed: (row && (row.inFeed === false)),
        profile: (user && user.ref) ? user.ref.load() : undefined
    });
});

// --------------------------------------------------------------------------------------------------

var DOCUMENTSTORE_KEY = 3;

P.getOverrides = function() {
    var instance = overrideStore.instance(DOCUMENTSTORE_KEY);
    return instance.lastCommittedDocument;
};

var overrideStore = P.defineDocumentStore({
    name: "overrides",
    formsForKey: function(key) {
        return [];
    },
    blankDocumentForKey: function(key) {
        return P.data.userDetailOverrides ? JSON.parse(P.data.userDetailOverrides) : {};
    }
});

P.respond("GET,POST", "/do/haplo-user-sync/admin/override", [
    {parameter:"json", as:"string", optional:true},
    {parameter:"saved", as:"string", optional:true}
], function(E, json, saved) {
    if(!O.application.config['haplo_user_sync:enable_detail_override']) {
        O.stop('User detail overrides are not enabled in this system.');
    }
    var instance = overrideStore.instance(DOCUMENTSTORE_KEY);
    var document = instance.lastCommittedDocument;
    if(E.request.method === "POST") {
        try {
            document = JSON.parse(json); // will throw if syntax error
        } catch(e) {
            E.response.body = "Error: "+e.message+" (Invalid JSON entered)";
            return;
        }
        instance.setCurrentDocument(document, true);
        instance.commit();
        return E.response.redirect("/do/haplo-user-sync/admin/override?saved=1");
    }
    E.render({
        pageTitle: "Override user details in sync files",
        backLink: "/do/haplo-user-sync/admin",
        overrideJSON: JSON.stringify(document, undefined, 2),
        saved: !!(saved)
    });
});

// --------------------------------------------------------------------------------------------------

P.respond("POST", "/do/haplo-user-sync/set-user-to-error-state", [
    {parameter:"r", as:"db", table:"users"}
], function(E, row) {
    row.error = true;
    row.save();
    E.response.redirect("/do/haplo-user-sync/admin/user-info?lookup="+row.username);
});

// --------------------------------------------------------------------------------------------------

var displayFileForm = P.form("file", "form/file.json");

P.respond("GET", "/do/haplo-user-sync/admin/sync-info", [
    {pathElement:0, as:"db", table:"sync"}
], function(E, sync) {
    var files = [];
    _.each(sync.files, function(file,name) {
        files.push({name:name,file:file});
    });
    var fileForm = files.length ? displayFileForm.instance({files:files}) : null;
    E.render({
        backLink: "/do/haplo-user-sync/admin",
        sync: sync,
        syncStatusText: P.STATUS_TEXT[sync.status],
        logText: sync.log,
        cancelable: sync.status <= P.SYNC_STATUS.ready,
        applyable: sync.status === P.SYNC_STATUS.ready,
        reapplyable: (sync.status === P.SYNC_STATUS.complete || sync.status === P.SYNC_STATUS.failure),
        cancelableForce: sync.status === P.SYNC_STATUS.running,
        files: fileForm
    });
});

// --------------------------------------------------------------------------------------------------

P.respond("POST", "/do/haplo-user-sync/admin/sync-action", [
    {parameter:"id", as:"db", table:"sync"},
    {parameter:"action", as:"string"}
], function(E, sync, action) {
    var setStatusTo;
    var redirectId = sync.id;
    switch(action) {
        case "cancel": setStatusTo = P.SYNC_STATUS.cancelled; break;
        case "apply": P.applySync(sync); break;
        case "reapply":
            redirectId = P.reapplySync(sync);
            break;
        default: break;
    }
    if(setStatusTo) {
        sync.status = setStatusTo;
        sync.save();
    }
    E.response.redirect("/do/haplo-user-sync/admin/sync-info/"+redirectId);
});

// --------------------------------------------------------------------------------------------------

P.respond("GET", "/do/haplo-user-sync/test/fetch-files", [
], function(E) {
    E.render();
});

P.respond("GET", "/do/haplo-user-sync/test/upload-file", [
], function(E) {
    var sync, syncQuery = P.db.sync.select().
        or(function(sq) { sq.where("status","=",P.SYNC_STATUS.uploading).where("status","=",P.SYNC_STATUS.ready); }).
        order("created",true).stableOrder().limit(1);
    if(syncQuery.length) { sync = syncQuery[0]; }
    var syncStatusText, fileForm;
    if(sync) {
        var files = [];
        _.each(sync.files, function(file,name) {
            files.push({name:name,file:file});
        });
        fileForm = files.length ? displayFileForm.instance({files:files}) : null;
        syncStatusText = P.STATUS_TEXT[sync.status];
    }
    var previousFiles = [];
    var lastSync = P.db.sync.select().
        or(function(sq) { sq.where("status","=",P.SYNC_STATUS.complete).where("status","=",P.SYNC_STATUS.failure); }).
        order("created",true).stableOrder().limit(1);
    if(lastSync.length) {
        _.each(lastSync[0].files, function(file,name) {
            previousFiles.push({name:name,digest:file.digest});
        });
    }
    E.render({
        backLink: "/do/haplo-user-sync/admin",
        syncStatusText: syncStatusText,
        files: fileForm,
        previousFiles: previousFiles
    });
});

P.respond("POST", "/do/haplo-user-sync/test/use-file", [
    {parameter: "name", as:"string", validate:/^[a-z0-9A-Z_\-]+$/},
    {parameter: "digest", as:"string"}
], function(E, name, digest) {
    var impl = P.getImplementation();
    // Find or create a new sync group
    var sync = P.findOrCreateSyncGroup();
    if(sync.status !== P.SYNC_STATUS.uploading) {
        E.response.kind = 'text';
        E.response.body = 'Sync in unexpected state -- use admin interface to resolve.';
        E.response.statusCode = HTTP.BAD_REQUEST;
        return;
    }

    // Store file and file info
    var file = O.file(digest);
    var files = sync.files;
    files[name] = {
        digest: file.digest,
        fileSize: file.fileSize,
        filename: file.filename
    };
    sync.filesJSON = JSON.stringify(files);
    if(impl.allFilesUploaded(files)) { sync.status = P.SYNC_STATUS.ready; }
    sync.save();
    return E.response.redirect("/do/haplo-user-sync/test/upload-file");
});
