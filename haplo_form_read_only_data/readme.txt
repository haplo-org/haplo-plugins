title: Form read only data
--

This plugin provides support for a form template element to display read only data in a form, which comes from information from entities or services.

This should be used instead of the @display-value@ element type unless there is a good reason not to, because it handles a lot of logic around fetching data from entities and displaying objects that is provided much more concisely with this feature.

NB: this only works if the form is implemented with the document store workflow feature or the transition decision form feature, because it expects to be able to access M from the external data of the form. Form read only data elements cannot be rendered in guides, so they will be omitted.

h2. Example

Example use in a form specification.

<pre>language=javascript
{
    "type": "render-template",
    "plugin": "haplo_form_read_only_data",
    "template": "display",
    "inDocument": true,
    "view": {
        "fields": [
            {"entity":"project"},
            {"entity":"project", "attribute":"hres:attribute:supervisor", "type":"ref"},
            {"label":"Maximum submission date", "service":"haplo:form-read-only-data:end-date", "path":"endDate", "type":"date"}
        ]
    }
}
</pre>

Note that if comments are enabled on the form, each use of the render-template element type will allow for a single comment to be left on the block of read only data values.

If using the service option, services are called with one argument, @M@. The service must be prefixed with @"haplo:form-read-only-data:"@. This decision was made in order to prevent forms from calling arbitrary services that may do all sorts of things in an application, especially since forms can now be defined by clients.

The service referenced above may be implemented something like:

<pre>language=javascript
P.implementService("haplo:form-read-only-data:end-date", function(M) {
    let dates = O.service("hres:project_journal:dates", M.entities.project_ref);
    let projectEnd = dates.date("project-end");
    return projectEnd ? projectEnd.requiredMax : undefined;
});
</pre>