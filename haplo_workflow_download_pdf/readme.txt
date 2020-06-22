title: Workflow download PDF
sort: 450
module_owner: Ben
--

This creates the option of downloading all forms in a workflow as a PDF. To use it, you will need to add this plugin to your plugin's dependencies.

h2(feature). workflow.use("haplo:download_pdf", spec)

Where spec may have optional properties:

* selector - when to display the download button
* setup - function called with 'pdf' object described below
* categories - array of category names
* excludeDocumentStores - array of document stores to exclude
* margins - margins for use when generating formatted text

Plugins may add any other properties to the specifiction, as long as they include a ':' character. This is useful for passing additional information to setup triggered by categories.

When generating a PDF, calls services named:

* haplo:workflow:download-pdf:setup   // but prefer to use the category one
* haplo:workflow:download-pdf:setup:work-type:WORK_TYPE
* haplo:workflow:download-pdf:setup:category:CATEGORY

with a pdf object, which has functions:

* headerFieldList(list)
* headerField(sort, name, value)
* section(sort, title, deferred)
* file(file)

and properties:

* workType
* M
* specification
* attachingFiles

If there is an edited version of the document and the current user is allowed to see the draft, they get the draft version when downloading.