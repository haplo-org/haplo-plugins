/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var registeredWorkflows = {};

P.workflow.registerWorkflowFeature("haplo:complete_form_in_advance_of_workflow",
    function(workflow, spec) {

        if(spec.name in registeredWorkflows) {
            throw new Error("haplo:complete_form_in_advance_of_workflow has already been used with name "+spec.name);
        }

        if(!("clearOnExit" in spec)) {
            throw new Error("haplo:complete_form_in_advance_of_workflow should provide a clearOnExit selector to remove stored data before subsequent workflows");
        }

        if(spec.workflowDocumentStore && !(spec.delegateOnEnter && spec.clearOnExit)) {
            throw new Error("haplo:complete_form_in_advance_of_workflow must provide delegateOnEnter and clearOnExit selectors to use workflowDocumentStore");
        }

        var store = P.defineDocumentStore({
            name: spec.name,
            keyIdType: "text",
            keyToKeyId: function(key) {
                return key.toString();
            },
            formsForKey: function(key) {
                return [spec.form];
            }
        });

        registeredWorkflows[spec.name] = {
            store: store,
            spec: spec,
            workflow: workflow
        };

        if(spec.infoPageBuildService) {
            P.implementService(spec.infoPageBuildService, function(project, builder) {
                var hasCommittedDocument = store.instance(project.ref).hasCommittedDocument;
                if(O.currentUser.allowed(spec.canUpdateDetails)) {
                    builder.sidebar.link(
                        "default",
                        "/do/haplo-workflow-complete-form-in-advance/input-details/"+
                            project.ref.toString()+"/"+spec.name,
                        spec.formTitle ? "Edit "+spec.formTitle.toLowerCase() : "Edit form",
                        hasCommittedDocument ? "standard" :"primary" 
                    );
                } else if(O.currentUser.allowed(spec.canViewDetails) && hasCommittedDocument) {
                    builder.sidebar.link(
                        "default",
                        "/do/haplo-workflow-complete-form-in-advance/view-details/"+
                            project.ref.toString()+"/"+spec.name,
                        spec.formTitle ? "View "+spec.formTitle.toLowerCase() : "View form",
                        "standard"
                    );
                }
            });
        }

        P.implementService("haplo:complete_form_in_advance_of_workflow:get_document:"+spec.name,
            function(projectRef) {
                var instance = store.instance(projectRef);
                return instance.lastCommittedDocument;
            }
        );

        workflow.observeEnter(spec.delegateOnEnter, function(M, transition, previousState) {
            M.workUnit.tags.advanceFormHandedOver = "1";
            M.workUnit.save();
        });

        workflow.observeExit(spec.clearOnExit, function(M) {
            // TODO probably should avoid using entities because it makes assumptions about
            // what the consumer is doing
            var instance = store.instance(M.entities.project_ref);
            instance.setCurrentDocument({}, false);
            instance.commit();
            delete M.workUnit.tags.advanceFormHandedOver;
        });

        if(spec.dashboardName) {
            P.implementService("std:reporting:dashboard:"+spec.dashboardName+":setup",
                function(dashboard) {
                    if(!dashboard.isExporting && O.currentUser.allowed(spec.canUpdateDetails)) {
                        dashboard.columns(1000, [
                            {
                                type: "html",
                                heading: "Edit details",
                                displayHTML: function(row) {
                                    return P.template("dashboard_link").render({
                                        projectRef: row.project.toString(),
                                        specName: spec.name
                                    });
                                }
                            }
                        ]);
                    }
                }
            );
        }

    }
);

P.respond("GET,POST", "/do/haplo-workflow-complete-form-in-advance/input-details", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"string"},
    {pathElement:2, as:"string", optional:true},
    {parameter:"showConfirmation", as:"string", optional:true},
    {parameter:"submitted", as:"string", optional:true},
], function(E, project, specName, view, showConfirmation, submitted) {
    var info = registeredWorkflows[specName];
    if(!info) { throw new Error("Unrecognised name "+specName); }
    var spec = info.spec;
    spec.canUpdateDetails.enforce();
    var instance = info.store.instance(project.ref);
    var document = instance.currentDocument;
    if(_.isEmpty(document) && spec.blankDocument) {
        document = spec.blankDocument(project);
    }
    var workflowStoreInstance;
    if(spec.workflowDocumentStore) {
        var workflowWorkUnit = O.work.query(info.workflow.fullName).
            tag("project", project.ref.toString()).
            tag("advanceFormHandedOver", "1").
            latest();
        if(workflowWorkUnit) {
            var M = info.workflow.instance(workflowWorkUnit);
            var workflowStore = info.spec.workflowDocumentStore;
            workflowStoreInstance = info.workflow.documentStore[workflowStore].instance(M);
            _.extend(document, workflowStoreInstance.currentDocument);
        }
    }
    if(spec.updateDocumentBeforeEdit) {
        spec.updateDocumentBeforeEdit(project, document);
    }
    var pageTitle = spec.pageTitle ? spec.pageTitle(project) : undefined;
    // TODO call prepareFormInstance()
    var form = spec.form.handle(document, E.request);
    if(E.request.method === "POST") {
        if(E.request.parameters.__later === "s") {
            instance.setCurrentDocument(document, false);
            if(spec.workflowDocumentStore) {
                if(workflowStoreInstance) {
                    workflowStoreInstance.setCurrentDocument(document, false);
                }
            }
            return E.response.redirect(E.request.path+"?showConfirmation=true");
        }
        if(form.complete) {
            instance.setCurrentDocument(document, true);
            instance.commit();
            if(spec.workflowDocumentStore) {
                if(workflowStoreInstance) {
                    workflowStoreInstance.setCurrentDocument(document, true);
                    workflowStoreInstance.commit();
                }
            }
            if(spec.onConfirm) {
                spec.onConfirm(document, project);
            }
            return E.response.redirect(E.request.path+"?showConfirmation=true&submitted=true");
        }
    }
    E.render({
        project: project,
        form: form,
        overlay: view === "overlay",
        pageTitle: pageTitle,
        showConfirmation: !!showConfirmation,
        submitted: !!submitted,
        saveForLater: spec.allowSaveForLater
    });
});

P.respond("GET,POST", "/do/haplo-workflow-complete-form-in-advance/view-details", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"string"}
], function(E, project, specName) {
    var info = registeredWorkflows[specName];
    if(!info) { throw new Error("Unrecognised name "+specName); }
    var spec = info.spec;
    spec.canViewDetails.enforce();
    var instance = info.store.instance(project.ref);
    var document = instance.currentDocument;
    var form = spec.form.instance(document);
    var pageTitle = spec.pageTitle ? spec.pageTitle(project) : undefined;
    var formTitle = spec.form.specification.formTitle;
    E.render({
        project: project,
        form: form.deferredRenderDocument(),
        pageTitle: pageTitle,
        formTitle: formTitle
    });
});
