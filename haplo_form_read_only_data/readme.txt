title: Form read only data
--

This plugin provides support for a form template element to display read only data in a form, which comes from information from entities or services.

This should be used instead of the @display-value@ element type unless there is a good reason not to, because it handles a lot of logic around fetching data from entities and displaying objects that is provided much more concisely with this feature.

NB: this only works if the form is implemented with the document store workflow feature or the transition decision form feature, because it expects to be able to access M from the external data of the form. Form read only data elements cannot be rendered in guides, so they will be omitted.

h2. Usage

Use a "render-template":https://docs.haplo.org/plugin/form/specification/render-template element with the following specification ("common form element properties":https://docs.haplo.org/plugin/form/specification#Common_properties can also be optionally included):

| @type@ | @"render-template"@ |
| @plugin@ | @"haplo_form_read_only_data"@ |
| @template@ | @"display"@ |
| @view@ | An object with the property @fields@ set to an array of objects |

Each object in @fields@ can contain the following properties (all properties are optional except where stated):

| @type@ | String field type. See "Field types":haplo_form_read_only_data/field-types. If @type@ is undefined, the object's title is displayed. |
| @label@ | String rendered in @<label>@ tags. For accessibility, always define labels here, not using the "common form element property":https://docs.haplo.org/plugin/form/specification#Common_properties of the same name. |
| @path@ | (required when using the [node:/haplo-plugins/haplo_form_read_only_data/history] feature) A location of the value within the document. Like a normal form element path, it needs to be unique within the document. |
| @service@ | * String name of a service returning the value to display. Must be prefixed with @"haplo:form-read-only-data"@ (see below). |
| @entity@ | * String name of a "workflow entity":https://docs.haplo.org/standard/workflow/definition/std-features/entities. Can be used with type @"ref"@ to display a link to the entity, or with an attribute name to display an attribute from that entity. |
| @attribute@ | * String name of an attribute. Used to display the value (or values) of the given attribute on the given entity. |

Note *: Each field should define one data source: either a @service@, an @entity@, or an @entity@ and an @attribute@.

Each field in @fields@ is displayed sequentially in the form and the document (unless overidden, for example using @include@ or @inDocument@).

If values shown in the document should be frozen as a record after the form is submitted (for example, to store the previous submission deadline in an extension workflow), see [node:/haplo-plugins/haplo_form_read_only_data/history].

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

h2. Services

If using the service option, services are called with one argument, @M@. The service must be prefixed with @"haplo:form-read-only-data:"@. This decision was made in order to prevent forms from calling arbitrary services that may do all sorts of things in an application, especially since forms can now be defined by clients.

The service referenced above may be implemented something like:

<pre>language=javascript
P.implementService("haplo:form-read-only-data:end-date", function(M) {
    let dates = O.service("hres:project_journal:dates", M.entities.project_ref);
    let projectEnd = dates.date("project-end");
    return projectEnd ? projectEnd.requiredMax : undefined;
});
</pre>