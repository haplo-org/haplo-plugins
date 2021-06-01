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
                existingVisibleSubworkflows: shape.existingVisibleSubworkflowsForUser(O.currentUser),
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
        _.each(shape.existingVisibleSubworkflowsForUser(O.currentUser), function(subworkflowInfo) {
            instances.push(subworkflowInfo.M);
        });
        W.render(O.service("std:workflow:deferred_render_combined_timeline", instances), "std:render");
        return true;
    });

};

// -------------------------------------------------------------------------
// UI properties

P.SubworkflowInfo.prototype.__defineGetter__("displayableSubworkflowName", function() {
    return this.spec._workflow.getWorkflowProcessName();
});

P.SubworkflowInfo.prototype.getBackLinkTextForObject = function(object) {
    var backLinkText = "Back";
    if(this.spec.backLinkText) {
        backLinkText = this.spec.backLinkText;
    } else if(object) {
        // Sensible back link text
        backLinkText = SCHEMA.getTypeInfo(object.first(A.Type)).name;
    }
    return backLinkText;
};

P.SubworkflowInfo.prototype.getStartTextForObject = function(object) {
    var i = P.locale().text("template");
    var displayableSubworkflowName = this.spec._workflow.getWorkflowProcessName();
    var startText = O.interpolateString(i["Would you like to start the {name}?"], {name: displayableSubworkflowName});
    if(this.spec.startText) {
        startText= this.spec.startText;
    }
    return startText;
};

P.SubworkflowInfo.prototype.__defineGetter__("checklistState", function() {
    if(!this.workUnit) { return "notStarted"; }
    return this.closed ? "closed" : "open";
});

// -------------------------------------------------------------------------
// UI properties when a sub-workflow exists

P.SubworkflowInfo.prototype.__defineGetter__("subworkflowSubmitterNameToShow", function() {
    if(
        !("$subworkflowSubmitterNameToShow" in this) &&
        this.spec.addSubmitterNameToWorkflowTitles &&
        this.M
    ) {
        this.$subworkflowSubmitterNameToShow = this.M.getActionableBy("submitter").name;
    }
    return this.$subworkflowSubmitterNameToShow;
});

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

    var parentM = P.subworkflowWorkUnitToParentInstance(workUnit);
    var info = P.subworkflows[workUnit.workType];
    var subworkflowInfo = (parentM && info) ? new P.SubworkflowInfo(parentM, info.spec, workUnit) : undefined;
    if(!subworkflowInfo || !subworkflowInfo.userCanView(O.currentUser)) {
        O.stop("Not permitted");
    }
    var M = subworkflowInfo.M;

    var builder = O.ui.panel();
    M.fillActionPanel(builder);
    E.renderIntoSidebar(builder.deferredRender(), "std:render");
    E.render({
        M: M,
        parentM: parentM,
        backLinkText: subworkflowInfo.getBackLinkTextForObject(object),
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
    var subs = _.find(shape.manuallyStartableSubworkflowsForUser(O.currentUser), function(subs) {
        return subs[0].spec.name === subworkflowType;
    });
    if(!subs) {
        O.stop("Not permitted");
    }
    var subworkflowToStart = subs[0];

    if(E.request.method === "POST") {
        var M = subworkflowToStart.start({});
        return E.response.redirect(M.url);
    }

    var i = P.locale().text("template");
    E.render({
        parentM: parentM,
        backLinkText: subworkflowToStart.getBackLinkTextForObject(object),
        object: object,
        confirm: {
            text: subworkflowToStart.getStartTextForObject(object),
            options: [{label:i["Start"]}],
            backLink: parentM.url,
            backLinkText: i["Cancel"]
        }
    });
    
});

