/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
 *  Workflow follow-on notes feature
 *
 *  Allows users to add follow-on notes to workflows.
 *
 *  Use by calling .use("haplo:follow_on_notes", spec) on a std:workflow object where
 *  spec is a JS object defining:
 *
 *      selector: (optional) specifies when follow-on notes can be added, (defaults to {closed:true})
 *      canCreateNote: (optional) a function returning true if the given user can create a note
 *      canSeePrivateNotes: (optional) a list of the roles which can see private notes (defaults to disabling private notes)
 *      privateNoteExplanation: (optional) a string explaining who cannot see private notes (defaults to not displaying anything,
 *         unless it's been overridden for std_workflow with NAME("std:workflow:notes-explanation-private")
 *
 *  Add an element to your workflow object in requirements.schema to display the follow-on notes:
 *
 *      element: std:group:everyone bottom haplo_workflow_follow_on_notes:display
 *
 *  Use the following to get a deferred render of the follow-on notes:
 *
 *      workflow.haploFollowOnNotes.deferredRender(M)
 *
 */

var NOTES_FORM = P.replaceableForm("note", "form/note.json");
var NOTES_FILES_FORM = P.replaceableForm("note_files_display", "form/note_files_display.json");

var workflowsWithFollowOnNotes = {};

P.workflow.registerWorkflowFeature("haplo:follow_on_notes", function(workflow, spec) {

    var i = {
        workflow: workflow,

        addSelector: spec.selector || {closed:true},
        privateNoteExplanation: spec.privateNoteExplanation || NAME("std:workflow:notes-explanation-private", ""),

        // canSeePrivateNotes(M, user), defaulting to false
        canSeePrivateNotes: spec.canSeePrivateNotes ? spec.canSeePrivateNotes : function() { return false; },

        canSeeEntry: function(M, user, document) {
            return !(document['private']) || i.canSeePrivateNotes(M, O.currentUser);
        },

        canCreateNote: function(M, user) {
            return !spec.canCreateNote || spec.canCreateNote(M, user);
        }
    };

    workflowsWithFollowOnNotes[workflow.fullName] = i;

    workflow.haploFollowOnNotes = {
        deferredRender: function(M) {
            var notes = [], notesEntries = M.timelineSelect().where("action","=","haplo_workflow_follow_on_notes");
            _.each(notesEntries, function(entry) {
                var document = entry.data;
                if(i.canSeeEntry(M, O.currentUser, document)) {
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
        if(!i.canSeeEntry(M, O.currentUser, entry.data)) { return; }
        return P.template("timeline/note").deferredRender({
            M: M,
            entry: entry
        });
    });

    workflow.actionPanel(i.addSelector, function(M, builder) {
        if(i.canCreateNote(M, O.currentUser)) {
            builder.link("default", "/do/workflow-follow-on-notes/add-follow-on-note/"+M.workUnit.id,
                "Add follow-on note", "secondary");
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
