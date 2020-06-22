title: Workflow follow on notes
--

Allows users to add follow-on notes to workflows.

Use by calling .use("haplo:follow_on_notes", spec) on a std:workflow object where spec is a JS object defining:

| selector | (optional) | specifies when follow-on notes can be added, (defaults to {closed:true}) |
| canCreateNote | (optional) | a function returning true if the given user can create a note |
| canSeePrivateNotes | (optional) | a list of the roles which can see private notes (defaults to disabling private notes) |
| privateNoteExplanation | (optional) | a string explaining who cannot see private notes (defaults to not displaying anything, unless it's been overridden for std_workflow with NAME("std:workflow:notes-explanation-private") |

Add an element to your workflow object in requirements.schema to display the follow-on notes:

    @element: std:group:everyone bottom haplo_workflow_follow_on_notes:display@

Use the following to get a deferred render of the follow-on notes:

    @workflow.haploFollowOnNotes.deferredRender(M)@
