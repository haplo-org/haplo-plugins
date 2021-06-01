/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var specsForWorkflow = {};
var USE_TRANSITION_DECISION_FORMS_FILTERING = O.application.config["haplo_force_review_documents:use_transition_decision_forms_filtering"] || false;

P.workflow.registerWorkflowFeature("haplo:workflow:force_review_documents", function(workflow, spec) {
    var specs = specsForWorkflow[workflow.fullName];
    if(!specs) { specsForWorkflow[workflow.fullName] = specs = []; }
    specs.push(spec);
    let Step = {
        id: "haplo:workflow:force_review_documents",
        sort: spec.transitionStepsSort || 100,
        title: function(M, stepsUI) {
            let i = P.locale().text("template");
            return i["Review"];
        },
        url: function(M, stepsUI) {
            return P.template("redirect-url").render({M:M});
        },
        complete: function(M, stepsUI) {
            return stepsUI.data["haplo:workflow:force_review_documents:complete"] || false;
        }
    };
    workflow.transitionStepsUI(spec.selector, function(M, step) {
        step(Step);
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-workflow-review-documents/review", [
    {pathElement:0, as:"workUnit"} // Security: Only allow actionable user to see this page
], function(E, workUnit) {
    var workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
    var M = workflow.instance(workUnit);

    var stepsUI = M.transitionStepsUI;
    var markAsComplete = function() {
        stepsUI.data["haplo:workflow:force_review_documents:complete"] = true;
        stepsUI.saveData();
        E.response.redirect(stepsUI.nextRedirect());
    };

    var reviewUI = O.service("haplo:workflow:review_documents:review_ui_deferred", M, O.currentUser);
    if(!reviewUI) {
        return markAsComplete();
    }

    // User confirmed they've reviewed the documents?
    if(E.request.method === "POST") {
        return markAsComplete();
    }

    E.renderIntoSidebar({}, "sidebar");
    E.renderIntoSidebar(reviewUI.links, "std:render");

    E.render({
        M: M,
        reviewUI: reviewUI
    });
});

// --------------------------------------------------------------------------

// Implemented as a service so other plugins can integrate forced reviews.
// Acceptable to call on any workflow instance, whether or not it uses the feature.
// SECURITY: Caller must ensure current user is permitted to see these forms.
P.implementService("haplo:workflow:review_documents:review_ui_deferred", function(M, user) {
    var specs = specsForWorkflow[M.workUnit.workType] || [];
    var spec = _.find(specs, (spec) => M.selected(spec.selector));
    if(!spec) { return; }
    var visibleStores = O.service("std:document_store:workflow:sorted_store_names_action_allowed", M, user, "view");
    if(USE_TRANSITION_DECISION_FORMS_FILTERING) {
        var visibleTransitionDecisionForms = O.service("haplo:workflow:transition_decision_form:get-form-id-view-allowed", M);
        if(visibleTransitionDecisionForms) {
            visibleStores = visibleStores.concat(visibleTransitionDecisionForms);
        }
    }
    if(visibleStores.length === 0) { return; }

    // Apply filters
    var stores = visibleStores.slice();
    if(spec.filterDocumentStores) {
        spec.filterDocumentStores.forEach(function(i) {
            if(M.selected(i.selector || {})) {
                if("set" in i) {
                    stores = _.intersection(visibleStores, i.set); // to only include ones user can see
                }
                if("exclude" in i) {
                    stores = _.difference(stores, i.exclude);
                }
            }
        });
    }

    var priorityDecode = O.service("std:action_panel_priority_decode");
    var sortAs = function(panel, priority) {
        return _.sprintf("%012d-%012d", priorityDecode(panel||0), priorityDecode(priority||0));
    };

    // Get documents and render if there is something to see
    var workflow = O.service("std:workflow:definition_for_name", M.workUnit.workType);
    var documents = [];
    var anchorIndex = 0;
    _.each(stores, function(name) {
        var s = workflow.documentStore[name];
        if(!s) {
            O.service("haplo:workflow:transition_decision_form:filter-documents-by-form-id", M, name, function(title, panel, priority, deferred) {
                documents.push({
                    title: title,
                    sort: sortAs(panel, priority),
                    unsafeAnchor: "formex"+(anchorIndex++),
                    deferred: deferred
                });
            });
        } else {
            var i = s.instance(M);
            if(i.hasCommittedDocument || i.currentDocumentIsEdited) {
                documents.push({
                    title: s.delegate.title,    // TODO: Get title from docstore in a more documented manner
                    sort: sortAs(s.delegate.panel, s.delegate.priority),
                    unsafeAnchor: "form"+(anchorIndex++),
                    deferred: i.deferredRenderCurrentDocument()
                });
            }
        }
    });
    // Other plugins might want to add things to review
    O.serviceMaybe("haplo:workflow:force_review_documents:additional-entries-to-review", M, user, function(title, panel, priority, deferred) {
        documents.push({
            title: title,
            sort: sortAs(panel, priority),
            unsafeAnchor: "formex"+(anchorIndex++),
            deferred: deferred
        });
    });
    documents = _.sortBy(documents, 'sort');

    // Maybe there weren't any forms to review after the filtering?
    if(documents.length === 0) { return; }

    return {
        documents: P.template("documents").deferredRender({documents:documents}),
        links: P.template("document-links").deferredRender({documents:documents})
    };
});
