/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var DOCSTORE_KEY = 1;

var mappingStore = P.defineDocumentStore({
    name: "mapping",
    keyToKeyId: function(key) { return key; },
    formsForKey: function(key) {
        var impl = P.getImplementation();
        return impl.getMappingForms(key);
    },
    blankDocumentForKey: function(key) {
        return {};
    }
});

P.getMappings = function() {
    return mappingStore.instance(DOCSTORE_KEY).lastCommittedDocument;
};

P.implementService("haplo_user_sync:get_mappings", function() {
    return P.getMappings();
});

P.replaceMappings = function(mapping) {
    var instance = mappingStore.instance(DOCSTORE_KEY);
    instance.currentDocument = mapping;
    instance.commit();
};

P.implementService("haplo_user_sync:replace_mappings", function(mapping) {
    return P.replaceMappings(mapping);
});

P.respond("GET", "/do/haplo-user-sync/mappings", [
], function(E) {
    var ui = mappingStore.instance(DOCSTORE_KEY).makeViewerUI(E, {
        showVersions: true,
        showCurrent: true
    });
    E.appendSidebarHTML(ui.sidebarHTML);
    E.render({
        backLink: "/do/haplo-user-sync/admin",
        ui: ui
    });
});

var MAPPINGS_FORM_EDITOR = {
    finishEditing: function(instance, E, complete) {
        if(complete) {
            instance.commit();
        }
        E.response.redirect("/do/haplo-user-sync/mappings");
    },
    gotoPage: function(instance, E, formId) {
        E.response.redirect("/do/haplo-user-sync/edit-mappings/mappings/"+formId);
    },
    render: function(instance, E, deferredForm) {
        E.render({
            backLink: "/do/haplo-user-sync/mappings",
            deferredForm: deferredForm
        }, "edit-mappings");
    }
};

P.respond("GET,POST", "/do/haplo-user-sync/edit-mappings", [
], function(E) {
    var instance = mappingStore.instance(DOCSTORE_KEY);
    instance.handleEditDocument(E, MAPPINGS_FORM_EDITOR);
});

P.respond("GET,POST", "/do/haplo-user-sync/mappings-help", [
], function(E) {
    E.render({
        backLink: "/do/haplo-user-sync/mappings"
    }, "mappings-help");
});

// -------------------------------------------------------------------------------------
// Used for moving between systems when developing, returning object name to code mapping.
// This is to handle refs changing between systems

P.respond("GET", "/do/haplo-user-sync/test/get-mappings-for-application-move", [
], function(E) {
    var document = {};
    _.map(mappingStore.instance(DOCSTORE_KEY).currentDocument, function(entries, key) {
        document[key] = [];
        _.each(entries, function(entry) {
            if(!entry.ref) { return; }
            document[key].push({
                code: entry.code,
                objectTitle: O.ref(entry.ref).load().firstTitle().toString()
            });
        }); 
    });
    E.response.kind = 'json';
    E.response.body = JSON.stringify(document, undefined, 2);
});
