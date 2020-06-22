/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var NOTES_FORM = P.replaceableForm("note", "form/note.json");
var NOTES_FILES_FORM = P.replaceableForm("note_files_display", "form/note_files_display.json");

var workflowsWithFollowOnNotes = {};

P.workflow.registerWorkflowFeature("haplo:follow_on_notes", function(workflow, spec) {

    var j = {
        workflow: workflow,

        addSelector: spec.selector || {closed:true},
        privateNoteExplanation: spec.privateNoteExplanation || NAME("std:workflow:notes-explanation-private", ""),

        // canSeePrivateNotes(M, user), defaulting to false
        canSeePrivateNotes: spec.canSeePrivateNotes ? spec.canSeePrivateNotes : function() { return false; },

        canSeeEntry: function(M, user, document) {
            return !(document['private']) || j.canSeePrivateNotes(M, O.currentUser);
        },

        canCreateNote: function(M, user) {
            return !spec.canCreateNote || spec.canCreateNote(M, user);
        }
    };

    workflowsWithFollowOnNotes[workflow.fullName] = j;

    workflow.haploFollowOnNotes = {
        deferredRender: function(M) {
            var notes = [], notesEntries = M.timelineSelect().where("action","=","haplo_workflow_follow_on_notes");
            _.each(notesEntries, function(entry) {
                var document = entry.data;
                if(j.canSeeEntry(M, O.currentUser, document)) {
                    notes.push({
                        entry: entry,
                        document: document,
                        files: document.files ? NOTES_FILES_FORM.instance(document) : undefined
                    });
                }
            });
            return P.template("show-follow-on-notes").deferredRender({notes:notes});
        }
    };

    workflow.renderTimelineEntryDeferred(function(M, entry) {
        if(entry.action !== "haplo_workflow_follow_on_notes") { return; }
        if(!j.canSeeEntry(M, O.currentUser, entry.data)) { return; }
        return P.template("timeline/note").deferredRender({
            M: M,
            entry: entry
        });
    });

    workflow.actionPanel(j.addSelector, function(M, builder) {
        if(j.canCreateNote(M, O.currentUser)) {
            var i = P.locale().text("template");
            builder.link("default", "/do/workflow-follow-on-notes/add-follow-on-note/"+M.workUnit.id,
                i["Add follow-on note"], "secondary");
        }
    });

});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/workflow-follow-on-notes/add-follow-on-note", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    var i = workflowsWithFollowOnNotes[workUnit.workType];
    if(!i) { O.stop("This workflow doesn't use follow on notes"); }
    var M = i.workflow.instance(workUnit);
    if(!(M && M.selected(i.addSelector) && i.canCreateNote(M, O.currentUser))) {
        O.stop("Not permitted");
    }
    var allowPrivate = !!(i.canSeePrivateNotes(M, O.currentUser));
    var document = {$p:allowPrivate}; // TODO: Don't put the flag in the document, use a forthcoming forms system thing for external data
    var form = NOTES_FORM.handle(document, E.request);
    if(form.complete) {
        M.addTimelineEntry("haplo_workflow_follow_on_notes", document);
        return E.response.redirect(M.url);
    }
    E.render({
        M: M,
        form: form,
        allowPrivate: allowPrivate,
        privateNoteExplanation: i.privateNoteExplanation
    });
});

// --------------------------------------------------------------------------

// Element for displaying notes on an object
P.element("display", "Follow on notes",
    function(L) {
        var workUnits = O.work.query().ref(L.object.ref).isEitherOpenOrClosed();
        if(workUnits.length > 0) {
            var i = workflowsWithFollowOnNotes[workUnits[0].workType];
            if(i) {
                var M = i.workflow.instanceForRef(L.object.ref);
                if(M) {
                    L.render(i.workflow.haploFollowOnNotes.deferredRender(M), "std:render");
                }
            }
        }
    }
);
