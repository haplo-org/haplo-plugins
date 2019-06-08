title: Multi-workflow doc stores
module_owner: Jenny
--

This plugin provides the ability to use a single document store across workflows. 

h3(feature). @haplo:multi-workflow-document-store@

The plugin registers the workflow feature @haplo:multi-workflow-document-store@. It is used with the parameter @config@, which is has fields @docstore@, which is a docstore object, and @spec@, which is the spec of the docstore.

h3. Behaviour

Viewing the docstore from a completed workflow will show you the version of the docstore when the workflow finished, with a note at the top that this is what is happening.
