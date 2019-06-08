/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Nice to add a link to user sync in the data import UI
P.implementService("haplo:data-import-framework:admin-ui:add-options", function(options) {
    options.push({
        action: "/do/haplo-user-sync/admin",
        label: "User sync",
        notes: "Configure user sync and view sync logs.",
        indicator: "standard"
    });
});

P.implementService("haplo:data-import-framework:admin-ui:add-documentation-links", function(options) {
    options.push({
        action: "https://docs.haplo.org/import/user-sync",
        label: "User sync",
        notes: "Documentation for the generic user sync.",
        indicator: "standard"
    });
});

// --------------------------------------------------------------------------

var CanAdministrateSync = O.action("haplo_user_sync:administer_sync");

P.respond("GET", "/do/haplo-user-sync-generic/control-file", [
], function(E) {
    CanAdministrateSync.enforce();
    if(!P.data.controlDigest) { O.stop("No control file uploaded"); }
    let file = O.file(P.data.controlDigest, P.data.controlFileSize);
    let control = JSON.parse(file.readAsString("utf-8"));
    E.render({
        json: JSON.stringify(control, undefined, 2),
        files: P.data.expectedFiles
    });
});

// --------------------------------------------------------------------------

var _groupsAndPeopleTypes; // array of objects with properties code (API code of group), typeActive, typePast

var getGroupsAndPeopleTypes = function() {
    if(!_groupsAndPeopleTypes) {
        _groupsAndPeopleTypes = [];
        O.serviceMaybe("haplo_user_sync_generic:gather_groups_and_people_types", _groupsAndPeopleTypes);
    }
    return _groupsAndPeopleTypes;
};

// --------------------------------------------------------------------------

// Show the list of managed groups in the user sync model information section
P.implementService("haplo:data-import-framework:admin-ui:model-information:additional:haplo:user-sync",
    function(deferreds) {
        let typeName = (t) => {
            if(t) {
                let info = SCHEMA.getTypeInfo(t);
                if(info) { return info.name; }
            }
            return "(none)";
        };
        deferreds.push(P.template("model-information/managed-groups").deferredRender({
            groups: getGroupsAndPeopleTypes().map((i) => {
                return {
                    code: i.code,
                    name: O.group(GROUP[i.code]).name,
                    typeActive: typeName(i.typeActive),
                    typePast: typeName(i.typePast)
                };
            })
        }));
    }
);

// --------------------------------------------------------------------------

let IMPL = function() {};

IMPL.prototype = {
    adminUI: function() {
        return P.template("admin-ui").deferredRender();
    },

    setDefaultFiles: function(set) {
        if(P.data.controlDigest) {
            try {
                set("_control", O.file(P.data.controlDigest, P.data.controlFileSize));
            } catch(e) {
                console.log("Failed to set control file as default (perhaps because this is a clone without files?) "+e);
            }
        }
    },

    observeUploadedFile: function(name, uploadedFile) {
        if(name === "_control") {
            let control, error, files;
            // Parse the file to make sure it's valid JSON
            try {
                control = JSON.parse(uploadedFile.readAsString("utf-8"));
            } catch(e) {
                return "Control file was not valid JSON: "+e.message;
            }
            let errors = O.service("haplo:data-import-framework:validate-control", control);
            if(errors.length) {
                return "File named _control is not a valid control file:\n  "+errors.join("\n  ");
            } else {
                files = _.keys(control.files).concat('_control').sort();
                if(control.model !== "haplo:user-sync") {
                    return 'model property in control file must be set to "haplo:user-sync"';
                }
            }
            // Store control file
            let file = O.file(uploadedFile);
            P.data.controlDigest = file.digest;
            P.data.controlFileSize = file.fileSize;
            P.data.expectedFiles = files;
        }
    },

    allFilesUploaded: function(files) {
        let expected = P.data.expectedFiles || ['___NO_CONTROL_FILE_YET___'];
        return _.isEqual(_.keys(files).sort(), expected);
    },

    fetchFilesFromServices: function() { return {}; },

    managedGroups: function() {
        return _.map(getGroupsAndPeopleTypes(), (g) => GROUP[g.code]);
    },

    apply: function(engine, files) {
        // Other plugins need to add functionality
        this._syncPlugins = [];
        O.serviceMaybe("haplo_user_sync_generic:get_sync_plugins", this._syncPlugins);

        let errorCallback = (message, record) => {
            engine.error(message);
        };

        let controlFile, dataFiles = {};
        _.each(files, (file, name) => {
            if(name === '_control') {
                controlFile = file;
            } else {
                dataFiles[name] = O.file(file);
            }
        });

        if(!controlFile) {
            throw new Error("Logic error: Unexpectedly trying to run a sync without a control file");
        }

        let control = JSON.parse(O.file(controlFile).readAsString("utf-8"));

        let batch = this.batch = O.service("haplo:data-import-framework:batch", control, dataFiles, errorCallback);
        batch.option("report-all-errors", true);

        let extractUsername = batch.makeExtractFunctionFromSimpleInstructionFor("user", "username");
        if(!extractUsername) {
            engine.error("No simple rule for extracting username from records. There needs to be a field instruction at the top level (not inside conditionals or loops) for destination:user, name:username");
            return;
        }

        this._syncPlugins.forEach((sp) => sp.onApply(engine, batch));

        let seenUsername = {},
            recordCount = 0;

        batch.eachRecord((record) => {
            let username = extractUsername(record);
            if(!username) {
                engine.error("No username in record "+recordCount+": "+JSON.stringify(record));
            } else {
                if(username in seenUsername) {
                    engine.error("Duplicate username: "+username+" (ignoring record "+recordCount+")");
                } else {
                    seenUsername[username] = true;
                    let recordIdentifier = "record "+recordCount+", user "+username;
                    let transformation = batch.prepareTransformation(record, recordIdentifier);
                    engine.user(record, false, {
                        username: username,
                        transformation: transformation
                    });
                }
            }
            recordCount++;
        });
    },

    extractUsername: function(detailsFull, implData) {
        return implData.username;
    },

    prepareForRecordAndExtractDetails: function(engine, record, profileObject, implData) {
        let transformation = implData.transformation;
        transformation.setTarget("user", {});
        transformation.setTarget("profile", profileObject);
        transformation.transform();
        this._syncPlugins.forEach((sp) => sp.onUpdatedRecord(engine, this.batch, record, transformation));
        return transformation.getTarget("user");
    },

    postApply: function(engine) {
        this._syncPlugins.forEach((sp) => sp.onPostApply(engine, this.batch));
    },

    updateProfileObject: function(engine, object, details, implData) {
        // Set type based on the groups
        object.remove(ATTR.Type);
        let groups = implData.transformation.getTarget("user").groups || [];
        _.each(getGroupsAndPeopleTypes(), (g) => {
            if(-1 !== groups.indexOf(g.code)) {
                object.appendType(g.typeActive);
            }
        });
    },

    updateBlockedProfileObject: function(engine, object, username, user) {
        let typePast;
        _.each(getGroupsAndPeopleTypes(), (g) => {
            if(user.isMemberOf(GROUP[g.code])) {
                typePast = g.typePast;
            }
        });
        if(typePast) {
            object.remove(ATTR.Type);
            object.appendType(typePast);
        }
        this._syncPlugins.forEach((sp) => sp.onUpdateBlockedProfileObject(engine, this.batch, object, username, user));
    },

    getMappingForms: function(key) { }
};

P.implementService("haplo_user_sync:get_implementation", function() {
    return new IMPL();
});
