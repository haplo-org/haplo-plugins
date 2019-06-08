/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var workflowsForDocstore = {};

P.workflow.registerWorkflowFeature("haplo:multi-workflow-document-store", function(workflow, config) {
    let docstoreDetails = config.getDocstoreDetails();
    let spec = docstoreDetails.spec;
    let docstore = docstoreDetails.docstore;
    workflow.use("std:document_store", spec, docstore);


    workflow.observeFinish({}, function(M) {
        let workUnit = M.workUnit;
        let instance = docstore.instance(M);
        let latestVersion = instance.history.length ? instance.history[instance.history.length - 1] : undefined;
        workUnit.data[spec.name+"Version"] = latestVersion ? latestVersion.version : undefined;
        workUnit.save();
    });
});

