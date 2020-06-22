/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



var pluginsUsingFeature = {};

P.workflow.registerWorkflowFeature("haplo:transition_decision_form", function(workflow, spec) {

    let selector = spec.selector || {};
    let showForTransitions = spec.transitions;
    let form = spec.form;
    if(!form) { throw new Error("form must be specified."); }
    let blankDocumentForKey = spec.blankDocumentForKey;
    let prepareFormInstance = spec.prepareFormInstance;
    let onTransitionCallback = spec.onTransition;

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
            transition: {type:"text"}
        });
    }

    // ----------------------------------------------------------------------

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
            if(!_.isEmpty(document)) {
                plugin.db.decisionFormStorage.create({
                    workUnitId: M.workUnit.id,
                    formId: form.formId,
                    userId: O.currentUser.id,
                    datetime: new Date(),
                    document: document,
                    transition: ui.requestedTransition
                }).save();
            }
        });
        if(onTransitionCallback) {
            onTransitionCallback(M, ui.transitionData);
        }
    });

    // Prevent the transition from happening if the form is not complete.
    workflow.transitionFormSubmitted(selector, function(M, E, ui) {
        withForm(M, E, ui, (instance, document) => {
            if(!instance.complete) {
                ui.preventTransition();
            }
        });
    });

    workflow.implementWorkflowService("haplo:transition_decision_form:last_committed_document", function(M, formId) {
        let docQuery = plugin.db.decisionFormStorage.select().
            where("workUnitId", "=", M.workUnit.id).
            where("formId", "=", formId).
            order("datetime", true).
            limit(1);
        return docQuery.length ? docQuery[0].document : {};
    });

    // ----------------------------------------------------------------------

    var hasPermission = function(M, viewArray) {
        return _.every(viewArray, function(v) {
            let can = v.selector ? (M.hasAnyRole(O.currentUser, v.roles) && M.selected(v.selector)) : M.hasAnyRole(O.currentUser, v.roles);
            return v.action === "deny" ? !can : can;
        });
    };

    // Display links to the form on the action panel
    if("panel" in spec) {
        workflow.actionPanel({}, function(M, builder) {
            let haveDecision = plugin.db.decisionFormStorage.select().
                where("workUnitId", "=", M.workUnit.id).
                where("formId", "=", form.formId).
                limit(1).
                count();
            let shouldAllow = spec.view ? hasPermission(M, spec.view) : true;
            if(haveDecision && shouldAllow) {
                builder.panel(spec.panel).
                    link(spec.priority || "default", spec.path+'/'+M.workUnit.id, spec.formCustomTitle || form.formTitleShort);
            }
        });

        plugin.respond("GET,POST", spec.path, [
            {pathElement:0, as:"workUnit", workType:workflow.fullName, allUsers:true}
        ], function(E, workUnit) {
            E.setResponsiblePlugin(P); // take over as source of templates, etc
            let M = workflow.instance(workUnit);
            if(!(!spec.view || hasPermission(M, spec.view))) {
                O.stop( { message: "You are not permitted to view this decision.", 
                          pageTitle: "Unauthorised Access" });
            }
            let formsQuery = plugin.db.decisionFormStorage.select().
                where("workUnitId", "=", M.workUnit.id).
                where("formId", "=", form.formId).
                order("datetime", true);
            let forms = _.map(formsQuery, function(row) {
                let instance = form.instance(row.document);
                instance.externalData({
                    "std_document_store:key": M,
                    requestedTransition: row.transition
                });
                if(prepareFormInstance) { prepareFormInstance(M, instance); }
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
