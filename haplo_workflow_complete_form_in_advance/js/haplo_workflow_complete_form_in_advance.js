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
            spec: spec
        };

        if(spec.infoPageBuildService) {
            P.implementService(spec.infoPageBuildService, function(project, builder) {
                // TODO how to make this text customisable? Can't use text system here
                if(O.currentUser.allowed(spec.canUpdateDetails)) {
                    builder.sidebar.link(
                        "default",
                        "/do/haplo-workflow-complete-form-in-advance/input-details/"+
                            project.ref.toString()+"/"+spec.name,
                        "Enter interview details",
                        "primary"
                    );
                }
            });
        }

        P.implementService("haplo:complete_form_in_advance_of_workflow:get_document:"+spec.name,
            function(projectRef) {
                var instance = store.instance(projectRef);
                return instance.currentDocument;
            }
        );

        workflow.observeExit(spec.clearWhen, function(M) {
            // TODO probably should avoid using entities because it makes assumptions about
            // what the consumer is doing
            var instance = store.instance(M.entities.project_ref);
            instance.setCurrentDocument({}, false);
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
    {parameter:"showConfirmation", as:"string", optional:true}
], function(E, project, specName, view, showConfirmation) {
    var info = registeredWorkflows[specName];
    if(!info) { throw new Error("Unrecognised name "+specName); }
    var spec = info.spec;
    spec.canUpdateDetails.enforce();
    var instance = info.store.instance(project.ref);
    var document = instance.currentDocument;
    if(_.isEmpty(document) && spec.blankDocument) {
        document = spec.blankDocument(project);
    }
    // TODO call prepareFormInstance()
    var form = spec.form.handle(document, E.request);
    if(form.complete) {
        instance.setCurrentDocument(document, true);
        if(spec.onConfirm) {
            spec.onConfirm(document, project);
        }
        return E.response.redirect(E.request.path+"?showConfirmation=true");
    }
    E.render({
        project: project,
        form: form,
        overlay: view === "overlay",
        showConfirmation: !!showConfirmation
    });
});
