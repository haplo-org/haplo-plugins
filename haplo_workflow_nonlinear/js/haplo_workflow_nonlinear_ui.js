/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.setupNonlinearWorkflowUI = function(workflow) {

    workflow.actionPanel({}, function(M, builder) {
        var shape = new P.Shape(M);
        builder.panel(110).style("special").element(1, {
            deferred: P.template("sidebar/subworkflows").deferredRender({
                shape: shape,
                manualStart: _.map(shape.manuallyStartableSubworkflowsForUser(O.currentUser), function(subs) {
                    return subs[0];
                })
            })
        });
    });

    // Replace timeline with combined timeline
    workflow.renderWork({}, function(M, W) {
        var instances = [M];
        var shape = new P.Shape(M);
        _.each(shape.existingSubworkflows, function(s) {
            var subM = s.M;
            if(subM) { instances.push(subM); }
        });
        W.render(O.service("std:workflow:deferred_render_combined_timeline", instances), "std:render");
        return true;
    });

};

// -------------------------------------------------------------------------
// UI properties for using the info object in a view

P.SubworkflowInfo.prototype.__defineGetter__("displayableSubworkflowName", function() {
    return this.spec._workflow.getWorkflowProcessName();
});

P.SubworkflowInfo.prototype.__defineGetter__("checklistState", function() {
    if(!this.workUnit) { return "notStarted"; }
    return this.closed ? "closed" : "open";
});

P.SubworkflowInfo.prototype.__defineGetter__("customTaskTitle", function() {
    if(this.workUnit) {
        return O.ref(this.workUnit.tags.submitter).load().title;
    }
});

// -------------------------------------------------------------------------
// UI properties when a sub-workflow exists

P.SubworkflowInfo.prototype.__defineGetter__("displayableStatus", function() {
    return this.M.getDisplayableStatus();
});

P.SubworkflowInfo.prototype.__defineGetter__("displayableCurrentlyWith", function() {
    if("$displayableCurrentlyWith" in this) { return this.$displayableCurrentlyWith; }
    this.$displayableCurrentlyWith = this.M.getCurrentlyWithDisplayName();
    return this.$displayableCurrentlyWith;
});

// --------------------------------------------------------------------------
// Display the sub-workflow on a page, so the main workflow isn't mixed

// TODO: Security check for workflows which don't have an object associated with them?
P.respond("GET", "/do/subworkflow/show", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    // Load object, acting as security check where the workflow is associated with an object
    var object = workUnit.ref ? workUnit.ref.load() : undefined;

    var M = O.service("std:workflow:definition_for_name", workUnit.workType).instance(workUnit);

    var builder = O.ui.panel();
    M.fillActionPanel(builder);
    E.renderIntoSidebar(builder.deferredRender(), "std:render");
    E.render({
        M: M,
        parentM: P.getParentWorkflowOfSubworkflow(M),
        // Use Type info to set a sensible backLinkText. TODO: could be defined in spec instead
        backLinkText: object ? SCHEMA.getTypeInfo(object.first(A.Type)).name : "Back",
        object: object,
        // TODO: fix rendering to be more in style with workflow workUnit render
        timeline: M.renderTimelineDeferred()
    });
    
});

// TODO: Security check for workflows which don't have an object associated with them?
P.respond("GET,POST", "/do/subworkflow/manual-start", [
    {pathElement:0, as:"workUnit", allUsers:true},
    {parameter:"type", as:"string"}
], function(E, workUnit, subworkflowType) {
    // Load object, acting as security check where the workflow is associated with an object
    var object = workUnit.ref ? workUnit.ref.load() : undefined;

    var parentM = O.service("std:workflow:definition_for_name", workUnit.workType).instance(workUnit);
    var shape = new P.Shape(parentM);
    var wus = _.find(shape.subworkflows, function(wus) {
        return wus.length &&
            (wus[0].spec.name === subworkflowType) &&
            wus[0].canStartManuallyByUser(O.currentUser);
    });
    if(!wus) { O.stop("Not allowed to start"); }

    if(E.request.method === "POST") {
        var M = wus[0].startWorkflow();
        return E.response.redirect(M.url);
    }

    E.render({
        parentM: parentM,
        // Use Type info to set a sensible backLinkText. TODO: could be defined in spec instead
        backLinkText: object ? SCHEMA.getTypeInfo(object.first(A.Type)).name : "Back",
        object: object,
        confirm: {
            text: "Would you like to start the "+wus[0].displayableSubworkflowName+"?",
            options: [{label:"Start"}],
            backLink: parentM.url,
            backLinkText: "Cancel"
        }
    });
    
});

