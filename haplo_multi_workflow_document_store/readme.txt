title: Multi-workflow doc stores
module_owner: Jenny
--

This plugin provides the ability to use a single document store across workflows. 

h3(feature). @.use(haplo:multi-workflow-document-store, config)@

The plugin registers the workflow feature @haplo:multi-workflow-document-store@. It takes a @config@ parameter, which is a JS object, with keys:

|@getDocStoreDetails@|Function - takes no arguments|

This should return an object with keys @docstore@ - a docstore object - and @spec@, which is the spec of that docstore.


h3. Behaviour

Viewing the docstore from a completed workflow will show you the version of the docstore when the workflow finished, with a note at the top that this is what is happening.

h3. Example usage

<pre>language=javascript
ProposalApprovalWorkflow.use("haplo:multi-workflow-document-store", {
    getDocstoreDetails() {
        let dmpDocstore = Object.create({docstore: P.dmpDocstore});
        dmpDocstore.spec = Object.create(P.dmpDocstoreSpec);
        dmpDocstore.spec.view = [{}];
        dmpDocstore.spec.edit = [
            {
                roles: ["researcher"],
                selector: {state: "wait_dmp_researcher"},
                transitionsFiltered: ["submit"]
            }
        ];
        dmpDocstore.spec.path = "/do/example-funding-proposal-approval/dmp-form";
        return dmpDocstore;
    }
});
</pre>
