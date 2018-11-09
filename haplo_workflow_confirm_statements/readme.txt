title: Haplo Workflow Confirm Statements
--
The user must agree with one or more statements before they can make a transition through the workflow UI.

Timeline entries are rendered to record that the user has agreed, with a link to the text they agreed to.

Statements and other UI text is obtained through the workflow text system, and an optional function in the specification is called to adjust this further. The actual text agreed is stored in a database, so there's a record of the actual text they agreed and you can change the text in your plugin without affecting statements agreed in the past.

There is reasonable default text for everything except the statements themselves.

h3(feature). haplo:confirm-statements

Ask the user to confirm statements. @spec@ contains:

h3(property). selector

*REQUIRED*: Selector when statements must be agreed.

h3(function). alterStatements(M, text, requestedTransition, state)

@requestedTransition@ and @state@ are optional.

This is called with the workflow text (see below) system search results i.e. an object with the properties:

|_. Property |_. Value |
| header | String. |
| statements | Array of strings. |
| label | String. |
| footer | String. |

Return the modified search results.

h3(function). deferredRenderStatements(M)

*Use this as a last resort, as storing HTML is unpleasant.*

Return a deferred render of a template, to be used instead of the statements and header.

This should only contain simple HTML, and not require any special styles. The rendered HTML will be stored in the database. 

h2. No statements

If the statements turn out to be empty, either because no text is specified or @alterStatements()@ deleted them, the additional confirmation UI is not displayed and the user may proceed with the transition as normal.

h2. Workflow text

The following text is looked up in the workflow text system for current state and UI's @requestedTransition@. You can change the search results using @alterStatements()@ if the text system is not flexible enough.

h4. Header text

* confirm-statements:header:STATE:TRANSITION
* confirm-statements:header:STATE
* confirm-statements:header

rendered with @std:text:paragraph()@. If not specified, a reasonable default is provided.

h4. Label

* confirm-statements:label:STATE:TRANSITION
* confirm-statements:label:STATE
* confirm-statements:label

for the confirmation checkbox. If not specified, a reasonable default is provided.

h4. Statements (required)

* confirm-statements:statements:STATE:TRANSITION
* confirm-statements:statements:STATE
* confirm-statements:statements

to which the user must agree. Multiple statements are separated by @\n@ newline characters.

h4. Footer

* confirm-statements:footer:STATE:TRANSITION
* confirm-statements:footer:STATE
* confirm-statements:footer

rendered with @std:text:paragraph()@. By default, no footer is displayed.

h4. Required notice

* confirm-statements:required-notice:STATE:TRANSITION
* confirm-statements:required-notice:STATE
* confirm-statements:required-notice

is the error message displayed with @std:ui:notice()@ when the user does not check the checkbox. If not specified, a reasonable default is provided.

h4. Timeline action

* confirm-statements:timeline-action

says what users did with the statements. Defaults to "confirmed statements", but you may need to use something more appropriate for your workflow.
