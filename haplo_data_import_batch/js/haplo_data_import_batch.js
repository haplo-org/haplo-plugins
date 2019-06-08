/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanUseAPI = O.action("haplo:data-import-batch:can-use-api").
    title("Can use API for batch import").
    allow("group", Group.BatchDataImport);

// --------------------------------------------------------------------------

P.db.table("control", {
    created: {type:"datetime"},
    digest: {type:"text"},
    fileSize: {type:"int"},
    comment: {type:"text"}
});

P.db.table("batch", {
    identifier: {type:"text"},
    created: {type:"datetime"},
    control: {type:"link"},
    comment: {type:"text"},
    files: {type:"json"},
    state: {type:"text"},
    errors: {type:"int", nullable:true},
    log: {type:"text", nullable:true}
}, {
    schedule: function(dryRun) {
        this.state = 'scheduled';
        this.save();
        // Impersonate SYSTEM for permissions and to avoid showing data in the Recent listing
        O.impersonating(O.SYSTEM, () => {
            O.background.run("haplo_data_import_batch:run", {
                id: this.id,
                dryRun: dryRun
            });
        });
    }
});

// --------------------------------------------------------------------------

var setErrorResponse = function(E, error) {
    E.response.kind = 'text';
    E.response.body = error;
    E.response.statusCode = HTTP.BAD_REQUEST;
};

var getBatchOrSetErrorResponse = function(E, batchIdentifier) {
    let batchQ = P.db.batch.select().where("identifier","=",batchIdentifier);
    if(batchQ.length === 0) {
        return setErrorResponse(E, "Batch not found: "+batchIdentifier);
    }
    return batchQ[0];
};

// --------------------------------------------------------------------------

const DEFAULT_CONTROL_COMMENT = 'Unnamed control file';

// On success, response is the control file digest with a 200 status code
P.respond("POST", "/api/haplo-data-import-batch/control", [
    {parameter:"comment", as:"string", optional:true},
    {parameter:"file", as:"file"}
], function(E, comment, uploadedFile) {
    CanUseAPI.enforce();
    let error, response, control;
    try {
        control = JSON.parse(uploadedFile.readAsString("utf-8"));
    } catch(e) {
        error = "Uploaded file is not JSON";
    }
    if(!error) {
        let validationErrors = O.service("haplo:data-import-framework:validate-control", control);
        if(validationErrors.length) {
            error = "Invalid control file:\n  "+validationErrors.join("\n  ");
        }
    }
    if(!error) {
        let storedFile = O.file(uploadedFile);
        let existing = P.db.control.select().
            where("digest","=",storedFile.digest).
            where("comment","=",comment || DEFAULT_CONTROL_COMMENT);    // so can use the same control file with multiple comments
        if(existing.count() === 0) {
            P.db.control.create({
                created: new Date(),
                digest: storedFile.digest,
                fileSize: storedFile.fileSize,
                comment: comment || DEFAULT_CONTROL_COMMENT
            }).save();
        }
        response = storedFile.digest;
    }
    if(error) {
        setErrorResponse(E, error);
    } else {
        E.response.body = response;
    }
    E.response.kind = 'text';
});

// --------------------------------------------------------------------------

// On success, response is the identifier of the batch, with a 200 status code
P.respond("POST", "/api/haplo-data-import-batch/batch", [
    {parameter:"control", as:"string"},
    {parameter:"comment", as:"string", optional:true}
], function(E, controlDigest, comment) {
    CanUseAPI.enforce();
    let controlQ = P.db.control.select().where("digest","=",controlDigest);
    if(controlQ.length === 0) {
        return setErrorResponse(E, "Control file not found: "+controlDigest);
    }
    let batch = P.db.batch.create({
        identifier: O.security.random.identifier(),
        created: new Date(),
        control: controlQ[0],
        comment: comment || "Unnamed batch",
        files: [],
        state: "uploading"
    });
    batch.save();
    E.response.kind = 'text';
    E.response.body = batch.identifier;
});

// --------------------------------------------------------------------------

// On success, response is the digest of the file, with a 200 status code
P.respond("POST", "/api/haplo-data-import-batch/file", [
    {parameter:"batch", as:"string"},
    {parameter:"name", as:"string"},
    {parameter:"file", as:"file"}
], function(E, batchIdentifier, name, uploadedFile) {
    CanUseAPI.enforce();
    let batch = getBatchOrSetErrorResponse(E, batchIdentifier);
    if(!batch) { return; }
    let files = batch.files,
        file = O.file(uploadedFile);
    files.push({
        name: name,
        file: {
            digest: file.digest,
            fileSize: file.fileSize,
            filename: file.filename
        }
    });
    batch.files = files;
    batch.save();
    E.response.kind = 'text';
    E.response.body = file.digest;
});

// --------------------------------------------------------------------------

// On success, returns "SCHEDULED" with 200 status code
P.respond("POST", "/api/haplo-data-import-batch/schedule", [
    {parameter:"batch", as:"string"},
    {parameter:"mode", as:"string", optional:true }
], function(E, batchIdentifier, mode) {
    CanUseAPI.enforce();
    let batch = getBatchOrSetErrorResponse(E, batchIdentifier);
    if(!batch) { return; }
    if(batch.state !== 'uploading') {
        return setErrorResponse(E, "Batch "+batchIdentifier+" is not in the 'uploading' state");
    }
    batch.schedule(mode === "dry-run");
    E.response.kind = 'text';
    E.response.body = 'SCHEDULED';
});

// --------------------------------------------------------------------------

P.backgroundCallback("run", function(data) {
    let batch = P.db.batch.load(data.id);
    if(batch.state !== 'scheduled') {
        throw new Error("Batch ID "+batch.id+" is in an unexpected state");
    }
    console.log("Batch import: Running "+batch.id+" ("+batch.identifier+")");
    batch.state = 'running';
    batch.save();
    let log = ["START: "+(new Date())],
        errorCount = 0,
        resultState;
    O.audit.write({
        auditEntryType: "haplo_data_import_batch:start",
        data: {
            batch: batch.identifier,
            control: batch.control.digest
        }
    });
    try {

        let errorCallback = (message, record) => {
            log.push(message);
        };

        let control = JSON.parse(O.file(batch.control.digest, batch.control.fileSize).readAsString("utf-8"));

        let dataFiles = {};
        _.each(batch.files, (f) => {
            dataFiles[f.name] = O.file(f.file);
        });

        let importBatch = O.service("haplo:data-import-framework:batch", control, dataFiles, errorCallback);
        importBatch.eachRecord((record) => {
            let transformation = importBatch.transform(record);
            if(transformation.isComplete) {
                if(!data.dryRun) {
                    transformation.commit();
                }
            }
        });

        errorCount = importBatch.errorCount;
        resultState = data.dryRun ? 'dry-run' : 'complete';
    } catch(e) {
        log.push("EXCEPTION: Error during import: "+e.message+". File: "+e.fileName+", line: "+e.lineNumber);
        resultState = 'error';
    }
    O.audit.write({
        auditEntryType: "haplo_data_import_batch:end",
        data: {
            batch: batch.identifier,
            control: batch.control.digest
        }
    });
    log.push("END: "+(new Date()));
    batch.state = resultState;
    batch.errors = errorCount;
    batch.log = log.join("\n");
    batch.save();
    console.log("Batch import: Finished "+batch.id+" ("+batch.identifier+")");
});
