/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAdministrateDataImport = O.action("haplo:data-import-framework:can-administrate");

P.implementService("haplo:data-import-framework:admin-ui:add-options", function(options) {
    options.push({
        action: "/do/haplo-data-import-batch/admin",
        label: "Batch import",
        notes: "Upload control files and data to import, view logs of previous batch import processes.",
        indicator: "standard"
    });
});

P.implementService("haplo:data-import-framework:admin-ui:add-documentation-links", function(options) {
    options.push({
        action: "https://docs.haplo.org/import/batch",
        label: "Batch import",
        notes: "Documentation for performing batch imports.",
        indicator: "standard"
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import-batch/admin", [
], function(E) {
    CanAdministrateDataImport.enforce();
    E.render({
        options: [
            {
                action: "/do/haplo-data-import-batch/control-files",
                label: "Control files",
                notes: "List control files, upload new control files, and start batch import jobs.",
                indicator: "standard"
            },
            {
                action: "/do/haplo-data-import-batch/batches",
                label: "Batch import jobs",
                notes: "List batch import jobs, view import logs, and import data after a dry run.",
                indicator: "standard"
            },
            {
                action: "/do/haplo-data-import-batch/create-api-key",
                label: "Create API key...",
                notes: "API keys authenticate your batch upload scripts with this Haplo application.",
                indicator: "standard"
            }
        ]
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-data-import-batch/create-api-key", [
], function(E) {
    CanAdministrateDataImport.enforce();
    if(E.request.method === "POST") {
        return E.render({
            key: O.serviceUser("haplo:service-user:data-import-batch:access").
                    createAPIKey("Batch Data Import", "/api/haplo-data-import-batch/")
        });
    }
    E.render({
        text: "Create new API key for batch data upload scripts?",
        options: [{label:"Create API key"}]
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import-batch/control-files", [
], function(E) {
    CanAdministrateDataImport.enforce();
    E.render({
        controlFiles: _.map(P.db.control.select().order("created",true), (row) => {
            return {
                digestTruncated: row.digest.substring(0,10),
                row: row
            };
        })
    });
});

P.respond("GET", "/do/haplo-data-import-batch/control-file", [
    {pathElement:0, as:"db", table:"control"}
], function(E, control) {
    CanAdministrateDataImport.enforce();
    E.render({
        control: control,
        json: JSON.stringify(
            JSON.parse(O.file(control.digest, control.fileSize).readAsString("utf-8")),
            undefined, 2
        )
    });
});

// --------------------------------------------------------------------------

var FilesForm = P.form("display-file-form", "form/display-file-form.json");

P.respond("GET", "/do/haplo-data-import-batch/batches", [
], function(E) {
    CanAdministrateDataImport.enforce();
    E.render({
        batches: _.map(P.db.batch.select().order("created",true), (row) => {
            return {
                identifierTruncated: row.identifier.substring(0,10),
                row: row
            };
        })
    });
});

P.respond("GET", "/do/haplo-data-import-batch/batch", [
    {pathElement:0, as:"db", table:"batch"}
], function(E, batch) {
    CanAdministrateDataImport.enforce();
    let view = {
        batch: batch,
        files: FilesForm.instance({files:batch.files})
    };
    view["state-"+batch.state] = true;
    E.render(view);
});


// --------------------------------------------------------------------------

var NewControlFileForm = P.form("new-control-file", "form/new-control-file.json");
var NewBatchForm = P.form("new-batch", "form/new-batch.json");

P.respond("GET,POST", "/do/haplo-data-import-batch/new-control-file", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let document = {},
        form = NewControlFileForm.handle(document, E.request);
    if(form.complete) {
        let control = P.db.control.create({
            created: new Date(),
            digest: document.file.digest,
            fileSize: document.file.fileSize,
            comment: document.comment
        });
        control.save();
        return E.response.redirect("/do/haplo-data-import-batch/control-file/"+control.id);
    }
    E.render({form:form});
});

P.respond("GET,POST", "/do/haplo-data-import-batch/new-batch/for-control", [
    {pathElement:0, as:"db", table:"control"}
], function(E, control) {
    CanAdministrateDataImport.enforce();
    let document = {},
        duplicates = [],
        form = NewBatchForm.handle(document, E.request);
    if(form.complete) {
        // Check file names are unique
        let dups = [], seenName = {};
        _.each(document.files, (f) => {
            if(f.name in seenName) {
                duplicates.push(f.name);
            }
            seenName[f.name] = true;
        });
        if(duplicates.length === 0) {
            let batch = P.db.batch.create({
                identifier: O.security.random.identifier(),
                created: new Date(),
                control: control,
                comment: document.comment,
                files: document.files,
                state: "ready"
            });
            batch.save();
            return E.response.redirect("/do/haplo-data-import-batch/batch/"+batch.id);
        }
    }
    E.render({
        control: control,
        duplicates: duplicates.length ? "Duplicate file names: "+duplicates.join(', ') : undefined,
        form: form
    }, "new-batch");
});

P.respond("GET,POST", "/do/haplo-data-import-batch/schedule-batch", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"db", table:"batch"}
], function(E, mode, batch) {
    CanAdministrateDataImport.enforce();
    if(batch.state !== "ready") {
        O.stop("Batch is in the wrong state");
    }
    let dryRun = (mode === "dry-run");
    if(E.request.method === "POST") {
        batch.schedule(dryRun);
        return E.response.redirect("/do/haplo-data-import-batch/batch/"+batch.id);
    }
    E.render({
        pageTitle: "Schedule batch: "+batch.comment,
        backLink: "/do/haplo-data-import-batch/batch/"+batch.id,
        backLinkText: "Cancel",
        text: dryRun ?
            "Run the import in dry run mode? Data will be checked but not imported." :
            "Import this data?\nThe application will be modified. Always do a dry run first.",
        options: [{
            label: dryRun ? "Dry run" : "Import data"
        }]
    }, "std:ui:confirm");
});

P.respond("GET,POST", "/do/haplo-data-import-batch/copy-batch", [
    {pathElement:0, as:"db", table:"batch"}
], function(E, batch) {
    CanAdministrateDataImport.enforce();
    if(E.request.method === "POST") {
        let copy = P.db.batch.create({
            identifier: O.security.random.identifier(),
            created: new Date(),
            control: batch.control,
            comment: batch.comment + " (copy)",
            files: batch.files,
            state: "ready"
        });
        copy.save();
        return E.response.redirect("/do/haplo-data-import-batch/batch/"+copy.id);
    }
    E.render({
        pageTitle: "Copy batch: "+batch.comment,
        backLink: "/do/haplo-data-import-batch/batch/"+batch.id,
        backLinkText: "Cancel",
        text: "Copy this batch so it can be run again?",
        options: [{label: "Copy batch"}]
    }, "std:ui:confirm");
});
