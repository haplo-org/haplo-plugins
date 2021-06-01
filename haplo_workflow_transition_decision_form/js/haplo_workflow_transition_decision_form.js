/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



var pluginsUsingFeature = {};
var workflowSpecs = {};
var USE_TRANSITION_DECISION_FORMS_FILTERING = O.application.config["haplo_force_review_documents:use_transition_decision_forms_filtering"] || false;

P.workflow.registerWorkflowFeature("haplo:transition_decision_form", function(workflow, spec) {

    let selector = spec.selector || {};
    let showForTransitions = spec.transitions;
    let form = spec.form;
    if(!form) { throw new Error("form must be specified."); }
    let id = spec.id || form.formId;
    let titleShort = spec.titleShort || spec.title || form.formTitleShort;
    let blankDocumentForKey = spec.blankDocumentForKey;
    let prepareFormInstance = spec.prepareFormInstance;
    let onTransitionCallback = spec.onTransition;
    let getAdditionalUIForEditor = spec.getAdditionalUIForEditor;
    let updateDocumentBeforeEdit = spec.updateDocumentBeforeEdit;

    // ----------------------------------------------------------------------

    let plugin = workflow.plugin;
    if(!pluginsUsingFeature[plugin.pluginName]) {
        pluginsUsingFeature[plugin.pluginName] = true;
        plugin.db.table("decisionFormStorage", {
            workUnitId: {type:"int", indexed:true},
            formId:     {type:"text"},
            userId:     {type:"int"},
            datetime:   {type:"datetime"},
            document:   {type:"json"},
            transition: {type:"text"},
            title: {type:"text", nullable:true}
        });
    }

    let ws = workflowSpecs[workflow.fullName];
    if(!ws) { workflowSpecs[workflow.fullName] = ws = {plugin:plugin, specs:[]}; }
    ws.specs.push(spec);

    // ----------------------------------------------------------------------

    let saveDocument = function(M, transition, document) {
        if(document && !_.isEmpty(document)) {
            plugin.db.decisionFormStorage.create({
                workUnitId: M.workUnit.id,
                formId: id,
                userId: O.currentUser.id,
                datetime: new Date(),
                document: document,
                transition: transition,
                title: spec.formCustomTitle || titleShort || null
            }).save();
        }
    };

    //use with key value pairs { propertyNameToRemove: propertyNameToReplaceWith }
    let switchPropertyNamesMaybe = function(parentObject, toRemoveAndReplace, optionalErrorMessageIfBothPropertiesDefined) {
        _.each(toRemoveAndReplace, (toReplaceWith, toRemove) => {
            if(optionalErrorMessageIfBothPropertiesDefined && _.has(parentObject, toRemove) && _.has(parentObject, toReplaceWith)) {
                throw new Error(optionalErrorMessageIfBothPropertiesDefined);
            }
            if(_.has(parentObject, toRemove)) {
                parentObject[toReplaceWith] = parentObject[toRemove];
                delete parentObject[toRemove];
            }
        });
    };

    if("transitionStepsSort" in spec && spec.transitionStepsSort) {

        // --------- Decision form as a transition UI step ------------------

        let Step = {
            id: "haplo:transition_decision_form:"+id,
            sort: spec.transitionStepsSort,
            title: function(M, stepsUI) {
                return titleShort;
            },
            url: function(M, stepsUI) {
                return spec.path+'/edit/'+M.workUnit.id;
            },
            complete: function(M, stepsUI) {
                return id in (stepsUI.data["haplo:transition_decision_form:document"]||{});
            },
            skipped: function(M, stepsUI) {
                // Steps UI uses a different mechanism for conditionally requiring decision forms
                // as it's too early to be able to use a selector.
                if("requestedTransitions" in spec && spec.requestedTransitions) {
                    if(-1 === spec.requestedTransitions.indexOf(M.transitionStepsUI.requestedTransition)) {
                        return true;
                    }
                }
            },
            commit: function(M, stepsUI, transition) {
                saveDocument(M, transition, (stepsUI.data["haplo:transition_decision_form:document"]||{})[id]);
            }
        };

        workflow.transitionStepsUI(spec.selector, function(M, step) {
            step(Step);
        });

        plugin.respond("GET,POST", spec.path+'/edit', [
            {pathElement:0, as:"workUnit", workType:workflow.fullName} // checks permissions
        ], function(E, workUnit) {
            E.setResponsiblePlugin(P); // take over as source of templates, etc
            let M = workflow.instance(workUnit);
            var stepsUI = M.transitionStepsUI;
            let document = (stepsUI.data["haplo:transition_decision_form:document"]||{})[id] || (blankDocumentForKey ? blankDocumentForKey(M) : {});
            let formInstance = form.instance(document);
            //let formInstance = form.handle(document, E.request);
            formInstance.externalData({
                "std_document_store:key": M,
                requestedTransition: stepsUI.requestedTransition
            });
            if(prepareFormInstance) {
                prepareFormInstance(M, formInstance);
            }
            if(updateDocumentBeforeEdit) {
                updateDocumentBeforeEdit(M, formInstance, document);
            }
            formInstance.update(E.request);
            if(formInstance.complete) {
                let data = stepsUI.data["haplo:transition_decision_form:document"] || {};
                data[id] = document;
                stepsUI.data["haplo:transition_decision_form:document"] = data;
                stepsUI.saveData();
                return E.response.redirect(stepsUI.nextRedirect());
            }
            E.render({
                M: M,
                spec: spec,
                incomplete: E.request.method === "POST",
                form: formInstance
            }, "steps-ui-edit-form");
        });

    } else {

        // --------- Decision form on the final transition page -------------

        let withForm = function(M, E, ui, fn) {
            if(showForTransitions && (-1 === showForTransitions.indexOf(ui.requestedTransition))) {
                return;
            }
            let state = ui.__transitionDecisionFormState;
            if(!state) {
                let document = blankDocumentForKey ? blankDocumentForKey(M) : {};
                let instance = form.instance(document);
                // mimic docstore workflow feature behaviour of setting std_document_store:key
                // so that things like global template functions can access M
                instance.externalData({
                    "std_document_store:key": M,
                    requestedTransition: ui.requestedTransition
                });
                if(prepareFormInstance) { prepareFormInstance(M, instance); }
                if(updateDocumentBeforeEdit) { updateDocumentBeforeEdit(M, instance, document); }
                instance.update(E.request);
                state = ui.__transitionDecisionFormState = [instance, document];
            }
            fn.apply(undefined, state);
        };

        // Add the form to the top of the page, render error message if not complete,
        // save document when complete.
        workflow.transitionUI(selector, function(M, E, ui) {
            withForm(M, E, ui, (instance, document) => {
                let view = {form:instance};
                if(getAdditionalUIForEditor) { 
                    let additionalUI = getAdditionalUIForEditor(M, instance, document);
                    let messageForDev = "Transition decision forms currently don't support the simultaneous use of formTop & top or formBottom & bottom - please see the docs for guidance.";
                    //ensure formTop/formBottom is passed to view
                    switchPropertyNamesMaybe(additionalUI, { top: "formTop", bottom: "formBottom" }, messageForDev);
                    view.additionalUI = additionalUI;
                }
                if(E.request.method === "POST" && !(instance.complete)) {
                    view.incomplete = true;
                    view.message = M._getTextMaybe(['transition-form-error'], [M.state]);
                }
                ui.addFormDeferred("top", P.template("transition-form").deferredRender(view));
            });
        });

        // Save the data to the database when the transition is confirmed
        // If an onTransition function is used, call it just before the transition is committed.
        workflow.transitionFormPreTransition(selector, function(M, E, ui) {
            withForm(M, E, ui, (instance, document) => {
                saveDocument(M, ui.requestedTransition, document);
            });
            if(onTransitionCallback) {
                onTransitionCallback(M, ui.transitionData);
            }
        });

        let preventTransitionOnIncompleteForm = function(M, E, ui) {
            withForm(M, E, ui, (instance, document) => {
                if(!instance.complete) {
                    ui.preventTransition();
                }
            });
        };

        // Prevent the transition from happening if the form is not complete.
        workflow.transitionFormSubmitted(selector, preventTransitionOnIncompleteForm);
        workflow.bypassTransitionFormSubmitted(selector, preventTransitionOnIncompleteForm);
    }

    workflow.implementWorkflowService("haplo:transition_decision_form:last_committed_document", function(M, formId) {
        let docQuery = plugin.db.decisionFormStorage.select().
            where("workUnitId", "=", M.workUnit.id).
            where("formId", "=", formId).
            order("datetime", true).
            limit(1);
        return docQuery.length ? docQuery[0].document : {};
    });

    workflow.implementWorkflowService("haplo:transition_decision_form:docstore_query", function(M, formId) {
        return plugin.db.decisionFormStorage.select().
            where("workUnitId", "=", M.workUnit.id).
            where("formId", "=", formId).
            order("datetime", true);
    });

    // ----------------------------------------------------------------------

    // Display links to the form on the action panel
    if("panel" in spec) {
        workflow.actionPanel({}, function(M, builder) {
            let haveDecision = plugin.db.decisionFormStorage.select().
                where("workUnitId", "=", M.workUnit.id).
                where("formId", "=", id).
                limit(1).
                count();
            let shouldAllow = spec.view ? hasDocumentViewingPermission(M, spec.view) : true;
            if(haveDecision && shouldAllow) {
                builder.panel(spec.panel).
                    link(spec.priority || "default", spec.path+'/view/'+M.workUnit.id, spec.formCustomTitle || titleShort);
            }
        });

        plugin.respond("GET", spec.path+'/view', [
            {pathElement:0, as:"workUnit", workType:workflow.fullName, allUsers:true}
        ], function(E, workUnit) {
            E.setResponsiblePlugin(P); // take over as source of templates, etc
            let M = workflow.instance(workUnit);
            let hasViewingPermission = (!spec.view || hasDocumentViewingPermission(M, spec.view));
            if(!hasViewingPermission) {
                O.stop( { message: "You are not permitted to view this decision.", 
                          pageTitle: "Unauthorised Access" });
            }
            let formsQuery = plugin.db.decisionFormStorage.select().
                where("workUnitId", "=", M.workUnit.id).
                where("formId", "=", id).
                order("datetime", true);
            let forms = _.map(formsQuery, function(row) {
                return formView(spec, M, row);
            });
            let view = {
                M: M,
                form: form,
                forms: forms
            };
            if(forms.length > 1 && !E.request.parameters.all) {
                view.forms = [forms[0]];
                view.showAllLink = true;
            }
            E.render(view, "view-forms");
        });
    }
});

// --------------------------------------------------------------------------

var hasDocumentViewingPermission = function(M, viewArray) {
    let hasValidSelectorOrRole = function(obj) {
        if(obj.action && !_.contains(["allow", "deny"], obj.action)) {
            throw new Error("The specified action property for view in transition decision forms is not valid. To deny a role document viewing permissions use action: 'deny', to allow viewing permissions you can omit the action property, or, to be explicit, use action: 'allow'.");
        }
        let isSelected = obj.selector ? M.selected(obj.selector) : true; //An empty selector {} will select on all states
        let currentUserAllowed = (!obj.roles || !obj.roles.length) ? true : M.hasAnyRole(O.currentUser, obj.roles); // An empty roles property will allow everyone to read the document
        return isSelected && currentUserAllowed;
    };

    if(!viewArray.length) { return true; } //Omitting these objects or specifying an empty list [] means that everyone can view the document.
    let hasDenyAction = _.some(viewArray, (v) => v.action === "deny");
    if(hasDenyAction) {
        let denySpecs = _.filter(viewArray, (v) => v.action === "deny");
        let shouldDeny = _.some(denySpecs,(d) => hasValidSelectorOrRole(d));
        if(shouldDeny) {
            return false;
        } else {
            viewArray = _.chain(viewArray).
                clone(this).
                difference(this, denySpecs).
                value();
        }
    }
    return viewArray.length ? _.some(viewArray, (v) => hasValidSelectorOrRole(v)) : true;
};

var formView = function(spec, M, row) {
    let instance = spec.form.instance(row.document);
    instance.externalData({
        "std_document_store:key": M,
        requestedTransition: row.transition
    });
    if(spec.prepareFormInstance) { spec.prepareFormInstance(M, instance); }
    return {
        row: row,
        user: O.user(row.userId),
        transition: {
            label: M.getTextMaybe("transition:"+row.transition),
            indicator: M.getTextMaybe("transition-indicator:"+row.transition),
            notes: M.getTextMaybe("transition-notes:"+row.transition)
        },
        form: instance
    };
};

// --------------------------------------------------------------------------

P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "haplo_workflow:transition_documents",
        depend: "std:workflow",
        sort: 1200,
        setup(serialiser) {
            serialiser.listen("std:workflow:extend", function(workflowDefinition, M, work) {
                work.transition_documents = {};
                let ws = workflowSpecs[M.workUnit.workType];
                if(ws) {
                    ws.specs.forEach((spec) => {
                        let formsQuery = ws.plugin.db.decisionFormStorage.select().
                            where("workUnitId", "=", M.workUnit.id).
                            where("formId", "=", spec.id || spec.form.formId).
                            order("datetime", true);
                        _.each(formsQuery, (form) => {
                            work.transition_documents[form.formId] = form.document;
                        });
                    });
                }
            });
        },
        apply(serialiser, object, serialised) {
            // Implemented as listener
        }
    });
});

P.implementService("haplo:workflow:transition_decision_form:get-form-id-view-allowed", function(M) {
    let ws = workflowSpecs[M.workUnit.workType];
    if(!ws) { return; }
    let formIds = [];
    _.each(ws.specs, (spec) => {
        let shouldView = spec.view ? hasDocumentViewingPermission(M, spec.view) : true;
        if(shouldView) {
            formIds.push(spec.id || spec.form.formId);
        }
    });
    return formIds;
});

P.implementService("haplo:workflow:transition_decision_form:filter-documents-by-form-id", function(M, formId, review) {
    let ws = workflowSpecs[M.workUnit.workType];
    if(!ws) { return; }
    let spec = _.find(ws.specs, (spec) => {
        return spec.id === formId || spec.form.formId === formId;
    });
    let formsQuery = ws.plugin.db.decisionFormStorage.select().
        where("workUnitId", "=", M.workUnit.id).
        where("formId", "=", formId).
        order("datetime", true).
        limit(1);
    if(formsQuery.length) {
        let deferred = P.template("_form").deferredRender(formView(spec, M, formsQuery[0]));
        review(spec.title || spec.form.formTitle, spec.panel, spec.priority, deferred);
    }
});

if(!USE_TRANSITION_DECISION_FORMS_FILTERING) {
    P.implementService("haplo:workflow:force_review_documents:additional-entries-to-review", function(M, user, review) {
        let ws = workflowSpecs[M.workUnit.workType];
        if(ws) {
            ws.specs.forEach((spec) => {
                let shouldView = spec.view ? hasDocumentViewingPermission(M, spec.view) : true;
                if(shouldView) {
                    let formsQuery = ws.plugin.db.decisionFormStorage.select().
                        where("workUnitId", "=", M.workUnit.id).
                        where("formId", "=", spec.id || spec.form.formId).
                        order("datetime", true).
                        limit(1);
                    if(formsQuery.length) {
                        let deferred = P.template("_form").deferredRender(formView(spec, M, formsQuery[0]));
                        review(spec.title || spec.form.formTitle, spec.panel, spec.priority, deferred);
                    }
                }
            });
        }
    });
}
