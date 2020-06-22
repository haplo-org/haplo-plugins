/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// --------------------------------------------------------------------------

var registeredWorkflows = {};

P.workflow.registerWorkflowFeature("haplo:download_pdf",
    function(workflow, spec) {
        if(!spec) { spec = {}; }
        registeredWorkflows[workflow.fullName] = spec;
        workflow.actionPanel(spec.selector || {}, function(M, builder) {
            var canDownload = _.some(O.service("std:document_store:workflow:sorted_store_names_action_allowed", M, O.currentUser, "view"), function(name) {
                if(_.contains(spec.excludeDocumentStores, name)) { return; }
                var store = workflow.documentStore[name];
                var instance = store.instance(M);
                var canViewDraft = O.service("std:document_store:workflow:form_action_allowed",
                    M, name, O.currentUser, 'viewDraft');
                return (instance.hasCommittedDocument || canViewDraft);
            });
            if(canDownload || (spec.canDownloadPDF && M.hasAnyRole(O.currentUser, spec.canDownloadPDF))) {
                builder.panel(1498).link("default", "/do/haplo-workflow-download-pdf/download/"+M.workUnit.ref+"/"+M.workUnit.id, "Download printable PDF...");
            }
        });
    }
);

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-workflow-download-pdf/download", [
    {pathElement:0, as:"object"}, // require an object for security check
    {pathElement:1, as:"workUnit", allUsers:true}
], function(E, application, workUnit) {
    var workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
    var M = workflow.instance(workUnit);
    var i = P.locale().text("template");
    if(E.request.method === "POST") {
        var attachingFiles = !!(E.request.parameters.attachments);
        var pipeline = O.fileTransformPipeline();
        O.service("haplo:workflow:download-pdf:setup-pipeline-for-workflow", M, pipeline, "output", attachingFiles);

        // ---- Download file
        var urlForOutput = pipeline.urlForOutputWaitThenDownload("output", 
            M.title.replace(/[^a-zA-Z0-9]+/g,'-')+".pdf", {
                pageTitle: O.interpolateString(i["Download {title}"], {title: M.title}),
                backLink: M.url,
                backLinkText: i["Back"]
            });
        pipeline.execute();
        E.response.redirect(urlForOutput);
    }
    E.render({
        M: M,
        application: application,
        text: i["Would you like to download this application as a single PDF with, or without, the attached files?"],
        options: [
            { label: i["Forms only"] },
            { label: i["With attachments"], parameters:{attachments:"1"} }
        ]
    });
});

var DEFAULT_MARGINS = {
    marginTop: 70,
    marginBottom: 70,
    marginLeft: 70,
    marginRight: 70
};

P.implementService("haplo:workflow:download-pdf:setup-pipeline-for-workflow",
    function(M, pipeline, outputName, attachingFiles) {
        var workUnit = M.workUnit;
        var workflow = O.service("std:workflow:definition_for_name", workUnit.workType);
        var spec = registeredWorkflows[workUnit.workType];
        var files = [];
        var headerFields = {};
        var headerFieldList = [];
        var sections = [];
        var css = [ P.loadFile("default.css") ];

        var pdf = {
            workType: workUnit.workType,
            M: M,
            specification: spec,
            attachingFiles: attachingFiles,
            headerFieldList: function(list){
                let innerList = list.slice();
                if(headerFieldList.length > 0){
                    _.each(innerList, function(name) {
                        if(!(_.contains(headerFieldList, name))){
                            headerFieldList.push(name);
                        }
                    });
                }
                else { headerFieldList = innerList; }
            },
            headerField: function(sort, name, value) {
                if(!(name in headerFields)) {
                    headerFields[name] = [];
                }
                headerFields[name].push({
                    sort: sort,
                    value: value
                });
            },
            section: function(sort, title, deferred) {
                sections.push({
                    sort: sort,
                    title: title,
                    deferred: deferred
                });
            },
            file: function(file) {
                if(attachingFiles) {
                    files.push(file);
                }
            },
            addAdditionalCSS: function(file) {
                css.push(file);
            }
        };

        // ---- Workflow specific setup
        if("setup" in spec) {
            spec.setup(pdf);
        }

        // ---- Document stores
        var forms = [];
        var searchForFilesInDocument = function(document, safety) {
            if(safety < 0) { O.stop("Bad document when searching for attached files"); }
            var isObject = _.isObject(document);
            // Does this look like a file?
            if(isObject && ("filename" in document) && ("digest" in document) && ("fileSize" in document)) {
                files.push(O.file(document));
            } else if(isObject || _.isArray(document)) {
                // _.each will work on objects with properties, and arrays
                _.each(document, function(value) {
                    searchForFilesInDocument(value, safety-1);
                });
            }
        };
        if("documentStore" in workflow) {
            _.each(O.service("std:document_store:workflow:sorted_store_names_action_allowed", M, O.currentUser, "view"), function(name) {
                if(_.contains(spec.excludeDocumentStores, name)) { return; }
                var store = workflow.documentStore[name];
                var instance = store.instance(M);
                var section = {
                    // TODO: Get title & sort from docstore properly (delegate is not a public property)
                    sort: store.delegate.sortDisplay || store.delegate.priority || 100,
                    title: M.getTextMaybe("docstore-panel-view-link:"+name) || store.delegate.title,
                };
                var canViewDraft = O.service("std:document_store:workflow:form_action_allowed",
                    M, name, O.currentUser, 'viewDraft');
                if(instance.currentDocumentIsEdited && canViewDraft) {
                    section.deferred = instance.deferredRenderCurrentDocument();
                    section.isDraft = true;
                } else if(instance.hasCommittedDocument) {
                    section.deferred = instance.deferredRenderLastCommittedDocument();
                }
                if(section.deferred) {
                    sections.push(section);
                    if(attachingFiles) {
                        let document = (!section.isDraft) ? instance.lastCommittedDocument : instance.currentDocument;
                        searchForFilesInDocument(document, 256);
                    }
                }
            });
        }

        // ---- See if anything wants to add additional things
        var serviceNames = [
            "haplo:workflow:download-pdf:setup",
            "haplo:workflow:download-pdf:setup:work-type:"+workUnit.workType
        ];
        if("categories" in spec) {
            _.each(spec.categories, function(n) { serviceNames.push("haplo:workflow:download-pdf:setup:category:"+n); });
        }
        _.each(serviceNames, function(n) { O.serviceMaybe(n, pdf); });

        // ---- Generate headers
        var headerTable = [];
        _.each(headerFields, function(values, name) {
            if((_.contains(headerFieldList, name)) || (headerFieldList.length === 0)){
                headerTable.push({
                    name: name,
                    sort: values[0].sort,
                    first: values[0],
                    rest: values.slice(1)
                });
            }
        });

        // ---- Generate HTML for documents etc
        var sortedSections = _.sortBy(sections, "sort");
        if(sortedSections.length) { sortedSections[sortedSections.length-1].isLast = true; }
        var view = {
            M: M,
            headerTable: _.sortBy(headerTable, "sort"),
            sections: sortedSections,
            files: files
        };

        var margins = {};
        if("margins" in spec) {
            margins = spec.margins;
            _.each(DEFAULT_MARGINS, function(value, key) {
                if(!(key in margins)) {
                    margins[key] = value;
                }
            });
        }

        pipeline.transform("std:generate:formatted_text", {
            output: outputName,
            html: P.template("download-text").render(view),
            css: _.map(css, function(file) {
                return file.readAsString();
            }).join("\n"),
            marginTop: margins.marginTop,
            marginBottom: margins.marginBottom,
            marginLeft: margins.marginLeft,
            marginRight: margins.marginRight
        });

        // ---- Attached files
        if(attachingFiles) {
            var concatFiles = [outputName];
            _.each(files, function(file) {
                var n = outputName+"file"+concatFiles.length;
                concatFiles.push(n);
                pipeline.file(n, file);
            });
            pipeline.transform("std:concatenate", {
                output: outputName,
                files: concatFiles,
                mimeType: "application/pdf",
                fallbackHTML: "<p>Can't attach $FILENAME, please review file online.</p>"
            });
        }
    }
);
