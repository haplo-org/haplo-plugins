/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*HaploDoc
node: /haplo_activity_guidance_notes
title: Activity guidance notes
sort: 40
--

Guidance notes are snippets of text which can be edited by admin users, \
intended as introductory text for a function.

They are grouped by activity (as in @haplo_activity_navigation@), and \
the notes are editable by users permitted to edit the activity.

In your plugin.json,

<pre>
    "depend": ["haplo_activity_guidance_notes"],
    "use": ["haplo:activity_guidance_notes"]
</pre>

Then define the note:

<pre>language=javascript
    var exampleNote = P.guidanceNote("activity-name", "example", "Example Note", "guidance/example.xml");
</pre>

Arguments are:

* Activity name
* Note name (as an URL path component)
* Note title, for display in editing UI and default page title
* Name of file containing default text, in @'guidance/'@ folder by convention

Create a file/guidance/example.xml file containing the default text, in the \
normal document format:

<pre>
    <doc>
        <h1>Heading</h1>
        <p>Paragraph text</p>
    </doc>
</pre>

Then to use it...

1) call @deferredRender()@ on the note object to get a deferred render you can \
use in your views.

2) call @respondIntroductionPage()@ on the note object.

<pre>language=javascript
    P.respond("GET", "/do/example/start-something", [
    ], function(E) {
        // Check permissions, setup, etc
        exampleNote.respondIntroductionPage(E, {
            continueLink: "/do/example/actually/start"
        });
    });
</pre>

@respondIntroductionPage@ takes an Exchange object and a view. All \
keys are optional:

* pageTitle, backLink -- as normal
* continueLink -- link to the next label
* continueLabel -- text for the continue button

3) call @getText()@ on the note object to get the plain-text contents of the note, suitable for use in e.g. @std:ui:choose@ @notes@.

*/

// --------------------------------------------------------------------------

var notesByActivity = {};

P.provideFeature("haplo:activity_guidance_notes", function(plugin) {
    plugin.guidanceNote = function(activityName, name, title, defaultTextFile, sort) {
        var info = {
            activityName: activityName,
            name: name,
            title: title,
            defaultTextFile: defaultTextFile,
            sort: sort || 999999,
            plugin: plugin
        };
        var list = notesByActivity[activityName];
        if(!list) {
            list = notesByActivity[activityName] = [];
            // Use oppourtunity of one-time init to add menu entry
            P.implementService("std:action_panel:activity:menu:"+activityName.replace(/-/g,'_'), function(display, builder) {
                var activity = O.service("haplo_activity_navigation:get_activity", activityName);
                if(O.currentUser.allowed(activity.editAction)) {
                    builder.panel(99999).
                        link(2000, "/do/activity-guidance-notes/edit/"+activity.name, "Edit "+activity.title+" guidance notes");
                }
            });
        }
        list.push(info);
        return new GuidanceNote(info);
    };
});

// --------------------------------------------------------------------------

P.db.table("notes", {
    activityName: {type:"text"},
    name: {type:"text"},
    document: {type:"text"}
});

var selectForNote = function(info) {
    return P.db.notes.select().
        where("activityName","=",info.activityName).
        where("name","=",info.name).
        limit(1);
};

var interpolateNAMEmatch = function(_, name) { return NAME(name); };
var interpolateNAME = function(_, text) { // must ignore first argument
    return text.replace(/\bNAME\(([^\)]+?)\)/g, interpolateNAMEmatch);
};

var getNoteDocument = function(info) {
    var s = selectForNote(info);
    if(s.length) {
        return s[0].document;
    } else {
        var text = info.plugin.loadFile(info.defaultTextFile).readAsString();
        return interpolateNAME(undefined, text);
    }
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/activity-guidance-notes/edit", [
    {pathElement:0, as:"string"}
], function(E, activityName) {
    var activity = O.service("haplo_activity_navigation:get_activity", activityName);
    activity.editAction.enforce();
    var notes = _.sortBy(notesByActivity[activityName] || [], 'sort');
    E.render({
        activity: activity,
        notes: notes
    });
});

// --------------------------------------------------------------------------

var editForm = P.form({
    specificationVersion:0,
    formId: "edit_form",
    formTitle: "Edit note",
    elements: [{
        type:"document-text",
        path:"document",
        required:true
    }]
});

P.respond("GET,POST", "/do/activity-guidance-notes/edit-note", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"string"}
], function(E, activityName, noteName) {
    var activity = O.service("haplo_activity_navigation:get_activity", activityName);
    activity.editAction.enforce();
    var note = _.find(notesByActivity[activityName] || [], function(i) { return i.name === noteName; });
    if(!note) { O.stop("No such note"); }
    var document = {
        document: getNoteDocument(note)
    };
    var form = editForm.handle(document, E.request);
    if(form.complete) {
        var row, s = selectForNote(note);
        if(s.length) {
            row = s[0];
        } else {
            row = P.db.notes.create({activityName:note.activityName, name:note.name});
        }
        row.document = document.document;
        row.save();
        return E.response.redirect("/do/activity-guidance-notes/edit/"+activity.name);
    }
    E.render({
        activity: activity,
        note: note,
        form: form
    });
});

// TODO: Some UI to default to default note? In a sensibly undoable manner.

// --------------------------------------------------------------------------

var GuidanceNote = function(info) {
    this.$info = info;
};

GuidanceNote.prototype = {
    deferredRender: function() {
        return P.template("display-note").deferredRender({
            document: O.text(O.T_TEXT_DOCUMENT, getNoteDocument(this.$info))
        });
    },
    getText: function() {
        return O.text(O.T_TEXT_DOCUMENT, getNoteDocument(this.$info)).toString("plaintext");
    },
    respondIntroductionPage: function(E, view) {
        E.setResponsiblePlugin(P);
        E.render(_.extend({
            $impl: {
                note: this.$info,
                document: O.text(O.T_TEXT_DOCUMENT, getNoteDocument(this.$info))
            }
        }, (view || {})), "introduction-page");
        if(view.continueLink) {
            E.renderIntoSidebar({
                elements: [{
                    label: view.continueLabel || "Continue",
                    href: view.continueLink,
                    indicator: "primary"
                }]
            }, "std:ui:panel");
        }
    }
};

