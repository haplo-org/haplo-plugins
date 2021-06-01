/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var SYNC_STATUS = P.SYNC_STATUS = {
    uploading: 100,
    ready: 200,
    running: 300,
    complete: 400,
    cancelled: 500,
    failure: 600
};

var STATUS_TEXT = P.STATUS_TEXT = {};

_.each(SYNC_STATUS, function(v, k) {
    STATUS_TEXT[v] = k;
});

// --------------------------------------------------------------------------------------------------

P.canUserAdministrateSync = O.action("haplo_user_sync:administer_sync").
        title("Can administer user sync").
        allow("group", Group.UserSystemAdmin).
        allow("group", Group.Administrators);

P.requestBeforeHandle = function(E) {
    if(0 === E.request.path.indexOf("/api")) {
        if(!(O.currentUser.isMemberOf(Group.Uploader) || O.currentUser.allowed(P.canUserAdministrateSync))) {
            E.response.kind = "text";
            E.response.body = "Not permitted";
            E.response.statusCode = HTTP.FORBIDDEN;
        }
    } else {
        P.canUserAdministrateSync.enforce();
    }
};

// --------------------------------------------------------------------------------------------------

var SYNC_REPORTING_API = O.application.config["haplo_user_sync:sync_report_endpoint"];

P.sendSyncReport = function() {
    if(!(P.data.config.email || SYNC_REPORTING_API)) {
        console.log("No email address or api endpoint configured for sync report");
        return;
    }
    var sync = P.db.sync.select().order("created", true).limit(2);
    var lastErrors = 0;
    if(sync.length > 1) {
        lastErrors = sync[1].errors;
    }
    var errorDelta = sync[0].errors - lastErrors;
    var subject = "User feed report / " + errorDelta + ' / ' + O.application.hostname;
    var view = {
        syncTime: sync[0].created.toString(),
        errorDelta: errorDelta,
        log: sync[0].log
    };
    var body = P.template("email/report-email").render(view);
    _.each((P.data.config.email || "").split(/\s*,\s*/), function(email) {
        O.email.template("haplo:email-template:user-sync-report").deliver(email, "User feed", subject, body);
    });
    if(SYNC_REPORTING_API) {
        O.httpClient(SYNC_REPORTING_API).
            method("POST").
            useCredentialsFromKeychain("Haplo user sync monitoring").
            bodyParameter("hostname", O.application.hostname).
            bodyParameter("status", STATUS_TEXT[sync[0].status]).
            bodyParameter("syncTime", sync[0].created.toString()).
            bodyParameter("errors", sync[0].errors).
            bodyParameter("errorDelta", errorDelta).
            request(SyncReporting, {});
    }
};

var SyncReporting = P.callback("sync_reporting", function(data, client, result) {
    console.log("User sync reporting success: ", result.successful);
    console.log("User sync reporting response body: ", result.body.readAsString());
});

// --------------------------------------------------------------------------------------------------

P.db.table("sync", {
    status: {type:"int"},
    created: {type:"datetime"},
    applied: {type:"datetime", nullable:true},
    log: {type:"text", nullable:true},
    comment: {type:"text", nullable:true},
    errors: {type:"int", nullable:true},
    filesJSON: {type:"text"} // JSON document of name -> digest
}, function(prototype) {
    prototype.__defineGetter__("files", function() {
        return JSON.parse(this.filesJSON);
    }); 
});

P.db.table("users", {
    username: {type:"text", indexed:true, uniqueIndex:true},
    userId: {type:"int", indexed:true, uniqueIndex:true},
    dataDigest: {type:"text"},
    inFeed: {type:"boolean"},
    lastSync: {type:"int"},
    error: {type:"boolean"}
});

P.db.table("lastUserData", {
    userId: {type:"int", indexed:true, uniqueIndex:true},
    json: {type:"text"}
});

// --------------------------------------------------------------------------------------------------

P.implementService("haplo_user_sync:username_to_user", function(username) {
    var q = O.usersByTags({"username": username.toLowerCase()});
    // Before moving to tags, only active users were found - keep that behaviour to avoid breaking assumptions
    return (q.length && q[0].isActive) ? q[0] : undefined;
});

P.implementService("haplo_user_sync:user_to_username", function(user) {
    return user.tags.username;
});

P.implementService("haplo_user_sync:ref_to_username", function(ref) {
    var user = O.user(ref);
    if(!user) { return undefined; }
    return user.tags.username;
});

P.implementService("haplo:data-import-framework:filter:haplo:email-to-ref", function() {
    return function(emailAddress) {
        var user = O.user(emailAddress);
        return user ? (user.ref||undefined) : undefined;
    };
});

// --------------------------------------------------------------------------------------------------

// This service is provided for cases where the raw data is needed, but it's not desirable to
// make it available "properly". Hopefully only required for troubleshooting type features.
P.implementService("haplo_user_sync:last_raw_data_for_user", function(user) {
    var q = P.db.lastUserData.select().where("userId","=",user.id);
    return q.length ? JSON.parse(q[0].json) : undefined;
});

// This service should only be required for migration actions
P.implementService("haplo_user_sync:query_users", function() {
    return P.db.users.select();
});

// --------------------------------------------------------------------------------------------------

P.implementService("haplo_user_sync:set_all_active_users_to_error_state", function() {
    _.each(P.db.users.select().where("inFeed","=",true).where("error","=",false), function(row) {
        row.error = true;
        row.save();
    });
});

// --------------------------------------------------------------------------------------------------

P.implementService("haplo_user_sync:set_user_to_error_state_by_username", function(username) {
    _.each(P.db.users.select().where("username","=",username.toLowerCase()), function(row) {
        row.error = true;
        row.save();
    });
});

// --------------------------------------------------------------------------------------------------

P.implementService("haplo_user_sync:update_user_row_by_username", function(currentUsername, newUsername) {
    _.each(P.db.users.select().where("username","=",currentUsername.toLowerCase()), function(row) {
        row.username = newUsername;
        row.save();
    });
    _.each(O.usersByTags({"username": currentUsername.toLowerCase()}), function (user) {
        user.tags.username = newUsername;
        user.saveTags();
    });
});

// --------------------------------------------------------------------------------------------------

// This service is provided for cases where users are created using haplo_login_created_users.
// Users are added to the users db to prevent duplicates if they are later included in the sync.
P.implementService("haplo_user_sync:register_login_created_users", function(userDetails) {
    var usernameCount = P.db.users.select().where("username","=",userDetails.username).count();
    var userIdCount = P.db.users.select().where("userId","=",userDetails.userId).count();
    if(usernameCount || userIdCount) { return; }
    var row = P.db.users.create({
        username: userDetails.username,
        userId: userDetails.userId,
        dataDigest: "",
        inFeed: false,
        lastSync: -1,
        error: false
    });
    row.save();
});

// --------------------------------------------------------------------------------------------------

var NULL_IMPL = {
    adminUI: function() { return ''; },
    fetchFilesFromServices: function() { return {}; },
    allFilesUploaded: function(files) { return true; },
    managedGroups: [], // Groups that the user sync controls, groups not listed here will be preserved
    apply: function(engine, files) { },
    postApply: function(engine) { },
    updateProfileObject: function(engine, object, details) { },
    getMappingForms: function(key) { },
    updateBlockedProfileObject: function(engine, object, username, user) { }
};

P.getImplementation = function() {
    if(O.serviceImplemented("haplo_user_sync:get_implementation")) {
        return O.service("haplo_user_sync:get_implementation");
    } else {
        return NULL_IMPL;
    }
};
