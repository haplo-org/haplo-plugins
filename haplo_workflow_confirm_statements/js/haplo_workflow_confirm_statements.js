/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*
 * Workflow confirm statements feature -- user must agree with one or more
 * statements before they can make a transition through the workflow UI.
 *
 * See readme.txt for details.
 *
 */

const NEW_TRANSITION_UI = !!O.application.config["std_workflow:new_transition_ui"];

const TEXT_DEFAULT_HEADER = "Please confirm you agree with the following statements:";
const TEXT_DEFAULT_LABEL = "I confirm I have read and agree with all the statements above.";
const TEXT_DEFAULT_REQUIRED_NOTICE = "You must confirm you have read and agree with all the statements.";
const TEXT_DEFAULT_REQUIRED_NOTICE_SINGLE = "You must confirm you have read and agree with the statement below.";

// --------------------------------------------------------------------------

// Because this is "legal" text, the actual text agreed is stored in a database table.
// To avoid storing the same thing over and over again, the timeline entries store the 
// digest of the serialised JSON.
P.db.table("text", {
    digest: {type:"text", indexed:true},    // SHA256 digest of json column
    json:   {type:"text"}                   // use text type for complete control over JSON, so digest definitely matches
});

var workflows = {};

// --------------------------------------------------------------------------

P.workflow.registerWorkflowFeature("haplo:confirm-statements", function(workflow, spec) {

    // Per-workflow basic setup
    if(!(workflow.fullName in workflows)) {
        workflows[workflow.fullName] = true;
        workflow.renderTimelineEntryDeferred(renderTimelineEntryDeferred);
    }

    // Display form
    workflow.transitionUI(spec.selector, function(M, E, ui) {
        let text = getTextForCurrentStateWorkflowUI(M, spec, ui);
        // Only display the UI if there are statements to confirm
        if(text) {
            ui.addFormDeferred("top", P.template("statements").deferredRender({
                NEW_TRANSITION_UI: NEW_TRANSITION_UI,
                requiredNotice: (E.request.method === "POST") ?
                    getText(M, M.state, ui.requestedTransition, "required-notice",
                        (text.singleStatement ? TEXT_DEFAULT_REQUIRED_NOTICE_SINGLE : TEXT_DEFAULT_REQUIRED_NOTICE)) : undefined,
                text: text
            }));
        }
    });

    // Prevent transition if not confirmed, add timeline entry if confirmed
    workflow.transitionFormSubmitted(spec.selector, function(M, E, ui) {
        let text = getTextForCurrentStateWorkflowUI(M, spec, ui);

        if(text) {
            if(E.request.parameters._wcs_confirm) {
                addTimelineEntryFor(M, text);
            } else {
                ui.preventTransition();
            }
        }
    });

});

// --------------------------------------------------------------------------

var getText = function(M, state, transition, name, defaultText) {
    return M.getTextMaybe(
        "confirm-statements:"+name+":"+state+":"+transition,
        "confirm-statements:"+name+":"+state,
        "confirm-statements:"+name
    ) || defaultText;
};

// --------------------------------------------------------------------------

var getTextForCurrentStateWorkflowUI = function(M, spec, ui) {
    let state = M.state;

    // NOTE: Order of properties in text object is important to remain
    // constant so that the digest of the JSON text is consistent over time.
    let text = {
        header: getText(M, state, ui.requestedTransition, "header", TEXT_DEFAULT_HEADER),
        label:  getText(M, state, ui.requestedTransition, "label", TEXT_DEFAULT_LABEL)
    };

    let footer = getText(M, state, ui.requestedTransition, "footer");
    if(footer) { text.footer = footer; }

    let statements = getText(M, state, ui.requestedTransition, "statements");
    if(statements) {
        text.statements = _.trim(statements).split(/[\r\n]+/);
    }

    if(spec.alterStatements) {
        text = spec.alterStatements(M, text, ui.requestedTransition, state);
    }

    let deferred = spec.deferredRenderStatements ? spec.deferredRenderStatements(M, ui.requestedTransition, state) : undefined;
    if(deferred) {
        text.unsafeHTML = P.template("std:render").render(deferred);
        // Header and footer are removed so deferred replaces everything (otherwise there couldn't be a default for the header)
        delete text.header;
        delete text.footer;
        delete text.statements; // not used
    } else {
        // Make sure alterStatements() can't set unsafeHTML
        delete text.unsafeHTML;
    }

    // Suitable for display as single statement?
    if(  text.statements && (text.statements.length === 1) &&
        (text.header === TEXT_DEFAULT_HEADER) && 
        !text.unsafeHTML
    ) {
        text.singleStatement = text.statements[0];
        // Tidy up the object so only the text that is used is stored in the database
        delete text.statements;
        delete text.header;
        delete text.label;
    }

    return (text.statements || text.singleStatement || text.unsafeHTML) ? text : undefined;
};

// --------------------------------------------------------------------------

var addTimelineEntryFor = function(M, text) {
    let textJSON = JSON.stringify(text);
    let textDigest = O.security.digest.hexDigestOfString("SHA256", textJSON);

    // Ensure this text exists in the database
    if(P.db.text.select().where("digest","=",textDigest).count() === 0) {
        P.db.text.create({
            digest: textDigest,
            json: textJSON
        }).save();
    }

    // Only the digest is stored in the timeline to save space
    M.addTimelineEntry("haplo:confirm-statements", {
        statements: textDigest
    });
};

// --------------------------------------------------------------------------

var renderTimelineEntryDeferred = function(M, entry) {
    if(entry.action !== "haplo:confirm-statements") { return; }
    return P.template("timeline-entry").deferredRender({
        M: M,
        entry: entry,
        text: M.getTextMaybe("confirm-statements:timeline-action")
    });
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/workflow-confirm-statements/view", [
    {pathElement:0, as:"workUnit", allUsers:true},
    {pathElement:1, as:"int"}
], function(E, workUnit, timelineEntryId) {
    if(workUnit.ref) { workUnit.ref.load(); } // check user can read any attached object
    let workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
    let M = workflow.instance(workUnit);
    let query = M.timelineSelect().
        where("id","=",timelineEntryId).
        where("action","=","haplo:confirm-statements").
        limit(1);
    if(query.length < 1) { O.stop("No confirmation"); }
    let entry = query[0];
    let textQuery = P.db.text.select().where("digest","=",entry.data.statements);
    if(textQuery.length < 1) { O.stop("Unknown statements"); }
    let text = JSON.parse(textQuery[0].json);
    E.render({
        M: M,
        entry: entry,
        text: text
    });
});
