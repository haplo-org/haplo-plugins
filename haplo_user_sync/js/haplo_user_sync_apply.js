/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.applySync = function(sync) {
    if(sync.status !== P.SYNC_STATUS.ready) { return; }
    runSync(sync);
};

P.reapplySync = function(oldSync) {
    if(!(oldSync.status === P.SYNC_STATUS.complete || oldSync.status === P.SYNC_STATUS.failure)) { return; }
    var sync = P.db.sync.create({
        status: P.SYNC_STATUS.ready,
        created: new Date(),
        filesJSON: oldSync.filesJSON
    }).save();
    runSync(sync);
    return sync.id;
};

var runSync = function(sync) {
    sync.status = P.SYNC_STATUS.running;
    sync.save();
    O.background.run("haplo_user_sync:apply", {id:sync.id});
};

P.backgroundCallback("apply", function(data) {
    O.impersonating(O.SYSTEM, function() {
        try {
            P.doSyncApply(P.db.sync.load(data.id));
        } catch(e) {
            // Log this error
            O.reportHealthEvent("User sync ID "+data.id+" has failed.\n\n", 
                    "Error in background job: "+e);
            var row = P.db.sync.load(data.id);
            row.status = P.SYNC_STATUS.failure;
            row.errors = (row.errors || 0) + 1;
            row.log = (row.log || '')+"\nError in background job: "+e;
            row.save();
            throw e;
        }
    });
});

P.doSyncApply = function(sync) {
    var impl = P.getImplementation();

    var errors = 0, applyUsername, errorForUsername, logLines = [];
    var log = function(message) {
        logLines.push(message);
    };
    var error = function(message) {
        log("ERROR: "+message);
        errors++;
        errorForUsername = applyUsername;   // Flag error happened
    };
    var skipped = 0;

    var postPhase = false, usernameToRef = {};

    var engine = {
        log: log,
        error: error,

        // Details must include:
        //    username (for login, primary key for user, mustn't change)
        //    title, nameFirst, nameLast, email (user basic details)
        //    groups (array of groups for membership)
        // If user is known to be incorrect, set errorState=true
        // Returns boolean of whether data was examined and changes potentially made.
        user: function(details, errorState) {
            var username = details.username.toLowerCase();
            applyUsername = username;
            errorForUsername = undefined;
            if(errorState) {
                errorForUsername = username;
                error(username+" is in error state");
            }
            try {
                // Use a digest of the details to change for changes to the underlying data
                var dataDigest = O.security.digest.hexDigestOfString("SHA1",JSON.stringify(details));

                var row, uq = P.db.users.select().where("username","=",username).limit(1);
                if(uq.length === 1) {
                    row = uq[0];
                    // Do we want to update all users regardless of data changes
                    if(!P.data.config.updateAll) {
                        // Can this be skipped because nothing changed, the user is active, and not in an error state?
                        if((dataDigest === row.dataDigest) && (row.inFeed === true) && !(row.error) && !(errorState)) {
                            row.lastSync = sync.id;
                            row.save();
                            // We'll need to update the username to ref mapping
                            if(row.userId) {
                                usernameToRef[row.username] = O.user(row.userId).ref;
                            }
                            skipped++;
                            return false;   // No changes made
                        }
                    }
                    log("update "+username);
                } else {
                    row = P.db.users.create({username: username});
                    log("create "+username);
                }

                var profileObject, updatedProfileObject, user = (row.userId ? O.user(row.userId) : undefined);

                // Profile
                if(user && user.ref) {
                    profileObject = user.ref.load();
                    updatedProfileObject = profileObject.mutableCopy();
                } else {
                    var labels;
                    if(impl.labelsForNewProfileObject) {
                        labels = impl.labelsForNewProfileObject(this, updatedProfileObject, details);
                    }
                    updatedProfileObject = labels ? O.object(labels) : O.object();
                }
                impl.updateProfileObject(this, updatedProfileObject, details);
                if(!(updatedProfileObject.firstType())) { updatedProfileObject.appendType(T.Person); }
                updatedProfileObject.remove(A.Title);
                updatedProfileObject.appendTitle(O.text(O.T_TEXT_PERSON_NAME, {
                    title: details.title ? details.title : "",
                    first: details.nameFirst,
                    last: details.nameLast
                }));
                updatedProfileObject.remove(ATTR["std:attribute:email"]);
                updatedProfileObject.append(O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, details.email), A.EmailAddress);

                if(!(profileObject && profileObject.valuesEqual(updatedProfileObject))) {
                    updatedProfileObject.save();
                }

                // Store mapping for later
                usernameToRef[username] = updatedProfileObject.ref;

                // Platform user
                var userDetails = {
                    email: details.email,
                    nameFirst: details.nameFirst,
                    nameLast: details.nameLast
                };
                if(user) {
                    if(!user.isActive) {
                        log("reactivate "+username);
                        user.setIsActive(true);
                    }
                    user.setDetails(userDetails);   // Won't modify user if nothing changed
                    // Preserve any groups to which the user has been added manually
                    var existingUnmanagedGroups = _.filter(user.directGroupIds, function(gid) {
                        return (-1 === impl.managedGroups.indexOf(gid));
                    });
                    user.setGroupMemberships(existingUnmanagedGroups.concat(details.groups));
                    if(!user.ref) {
                        log("Creating store object for user: "+username);
                        user.ref = updatedProfileObject.ref;
                    }
                } else {
                    userDetails.groups = details.groups;
                    userDetails.ref = updatedProfileObject.ref;
                    user = O.setup.createUser(userDetails);
                    row.userId = user.id;
                }

                // Update database
                row.lastSync = sync.id;
                row.dataDigest = dataDigest;
                row.error = !!(errorForUsername);
                row.inFeed = true;
                row.save();
                // Unset error state now it's been saved (although will be set again if something happens now)
                errorForUsername = undefined;

                // Keep the full details for debugging in a separate table. This avoids the entries in the
                // main users table being too large.
                // TODO: Database API doesn't let this be done in a nicer way yet
                var lastUserDataQ = P.db.lastUserData.select().where("userId","=",user.id).limit(1);
                if(lastUserDataQ.length === 0) {
                    P.db.lastUserData.create({userId:user.id,json:JSON.stringify(details)}).save();
                } else {
                    lastUserDataQ[0].json = JSON.stringify(details);
                    lastUserDataQ[0].save();
                }

            } catch(e) {
                error("("+username+") "+e);
                console.log("Exception caught within engine.user()", e);
            } finally {
                applyUsername = undefined;
            }

            // Make sure any error state is properly recorded
            if(errorForUsername) {
                var efuq = P.db.users.select().where("username","=",errorForUsername);
                if(efuq.length > 0) {
                    efuq[0].error = true;
                    efuq[0].save();
                }
                errorForUsername = undefined;
            }

            return true;    // Did syncing
        },

        getUsernameToRefMapping: function() {
            // The mapping isn't known until all the users have been processed.
            if(!postPhase) {
                throw new Error("Mapping isn't available until all the users have been processed.");
            }
            return usernameToRef;
        },

        errorForUsername: function(username, message) {
            username = username.toLowerCase();
            if(!postPhase) {
                throw new Error("Can't use errorForUsername until all the users have been processed.");
            }
            error(""+username+": "+message);
            var uq = P.db.users.select().where("username","=",username);
            if(uq.length > 0 && !(uq[0].error)) {
                uq[0].error = true;
                uq[0].save();
            }
        }
    };

    log("START: "+new Date());
    O.audit.write({auditEntryType: "haplo_user_sync:start"});
    var blocked = 0;
    var success = true;
    try {
        impl.apply(engine, sync.files, P.getOverrides());
        log(""+skipped+" user records had no changes");

        // Make mapping available, then see if the implementation wants to do anything more
        postPhase = true;
        if(impl.postApply) {
            impl.postApply(engine);
        }

        // Block any users omitted from the feed
        _.each(P.db.users.select().where("lastSync","<>",sync.id).where("inFeed","=",true), function(row) {
            log("block "+row.username);
            var user = O.user(row.userId);
            user.setIsActive(false);
            row.inFeed = false;
            row.save();
            blocked += 1;
            // Let the implementation update the profile object. For ease of implementation,
            // and avoiding problems if last details was corrupt, only provide the username and user object.
            if(user.ref) {
                var profileObject = user.ref.load();
                var updatedProfileObject = profileObject.mutableCopy();
                impl.updateBlockedProfileObject(engine, updatedProfileObject, row.username, user);
                if(!(profileObject.valuesEqual(updatedProfileObject))) {
                    updatedProfileObject.save();
                }
            }
        });
        if(blocked > 0) {
            log("Blocked "+blocked+" users");
        }
    } catch(e) {
        success = false;
        log("EXCEPTION: Error during sync: "+e);
    }

    log("END: "+new Date());
    O.audit.write({
        auditEntryType: "haplo_user_sync:end",
        data: {
            skipped: skipped,
            blocked: blocked
        }
    });

    sync.status = success ? P.SYNC_STATUS.complete : P.SYNC_STATUS.failure;
    sync.applied = new Date();
    sync.errors = success ? errors : errors+1;
    sync.log = logLines.join("\n");
    sync.save();

    P.sendSyncReport();
};
