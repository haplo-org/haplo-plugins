/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
    Provides a workflow feature to force users making workflow transitions
    to review documents in document stores.

    ExampleWorkflow.use("haplo:workflow:force_review_documents", {
        selector: {...},
        filterDocumentStores: [
            {selector:{...}, set:[...], exclude:[...]},
            ...
        ]
    });

    The selector chooses which states need this force approval step. It is
    recommended you use a {flags:[...]} style selector and apply a single
    flag in your states definition.

    By default, all forms that the user is permitted to see will be displayed
    for review. In some states, they should only be reviewing a subset of
    forms. The filterDocumentStores property controls which forms are
    displayed.

    Each element in the filterDocumentStores array is an object with a
    selector, which determines whether the filter is applied, then two
    optional properties which are both arrays of store names:

       set - set the list of stores to be displayed (if the user is
             permitted to view the store).
       exclude - exclude the given list of stores from display.

    Filters are applied in order, so an early 'exclude' will be overridden
    by a later 'set'.

    Even with filtering, only forms that the user is permitted to view will
    be displayed.

    If there are no forms with data, or they're all filtered out, then the
    force review UI is skipped.

*/

// --------------------------------------------------------------------------

var specForWorkflow = {};

P.workflow.registerWorkflowFeature("haplo:workflow:force_review_documents", function(workflow, spec) {
    specForWorkflow[workflow.fullName] = spec;
    workflow.transitionUI(spec.selector, checkHasReviewed);
    workflow.transitionUIWithoutTransitionChoice(spec.selector, checkHasReviewed);
});

// --------------------------------------------------------------------------

var checkHasReviewed = function(M, E, ui) {
    // Don't mess with anything other than GETs.
    if(E.request.method !== "GET") { return; }
    // Stop now if reviewed, but pass on reviewed flag to any other bit of transition UI
    if(E.request.parameters.reviewed === "yes") {
        ui.addUrlExtraParameter("reviewed", "yes");
        return;
    }
    // Otherwise redirect to page to transition (will include state in parameters)
    E.response.redirect(P.template("redirect-url").render({M:M,E:E}));
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-workflow-review-documents/review", [
    {pathElement:0, as:"workUnit"} // Security: Only allow actionable user to see this page
], function(E, workUnit) {
    var workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
    var M = workflow.instance(workUnit);

    var forwardTransitionParams = _.clone(E.request.parameters);
    forwardTransitionParams.reviewed = "yes";
    var forwardUrl = M.transitionUrl(undefined, forwardTransitionParams);

    var reviewUI = O.service("haplo:workflow:review_documents:review_ui_deferred", M, O.currentUser);
    if(!reviewUI) {
        return E.response.redirect(forwardUrl);
    }

    E.renderIntoSidebar({
        elements: [{
            href: forwardUrl, 
            label: "Continue",
            indicator: "primary"
        }]
    }, "std:ui:panel");
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
    var spec = specForWorkflow[M.workUnit.workType];
    if(!(spec && M.selected(spec.selector))) { return; }
    var visibleStores = O.service("std:document_store:workflow:sorted_store_names_action_allowed", M, user, "view");
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

    // Get documents and render if there is something to see
    var workflow = O.service("std:workflow:definition_for_name", M.workUnit.workType);
    var documents = [];
    var anchorIndex = 0;
    _.each(stores, function(name) {
        var s = workflow.documentStore[name];
        var i = s.instance(M);
        if(i.hasCommittedDocument || i.currentDocumentIsEdited) {
            documents.push({
                title: s.delegate.title,    // TODO: Get title from docstore in a more documented manner
                unsafeAnchor: "form"+(anchorIndex++),
                deferred: i.deferredRenderCurrentDocument()
            });
        }
    });

    // Maybe there weren't any forms to review after the filtering?
    if(documents.length === 0) { return; }

    return {
        documents: P.template("documents").deferredRender({documents:documents}),
        links: P.template("document-links").deferredRender({documents:documents})
    };
});
