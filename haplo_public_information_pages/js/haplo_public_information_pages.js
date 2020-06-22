/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// --------------------------------------------------------------------------

P.provideFeature("haplo:public_information_page", function(plugin) {
    plugin.definePublicInformationPage = definePage;
});

// --------------------------------------------------------------------------

var PublicInformationPage = function(spec) {
    this.$name = spec.name;
    this.$spec = spec;
};

PublicInformationPage.prototype.publicUrl = function() {
    return "/do/public-information/"+this.$name;
};

PublicInformationPage.prototype.editUrl = function() {
    if(!this.$spec.editAction) { throw new Error("No editAction defined for page"); }
    return "/do/public-information-edit/"+this.$name;
};

// --------------------------------------------------------------------------

var PAGE_FORM = P.form("page", "form/page.json");

var PageStore = P.defineDocumentStore({
    name: "pages",
    keyIdType: "text",
    formsForKey: function(page, instance) {
        return (pages[page].form ? [pages[page].form] : [PAGE_FORM]);
    }
});

// --------------------------------------------------------------------------

var pages = {};

var definePage = function(spec) {
    if(!spec.name) { throw new Error("Bad name"); }
    if(spec.name in pages) { throw new Error("Page already defined"); }
    pages[spec.name] = spec;
    return new PublicInformationPage(spec);
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/public-information", [
    {pathElement:0, as:"string"}
], function(E, name) {
    if(!(name in pages)) { return; }    // 404
    var page = PageStore.instance(name);
    var spec = pages[name];
    if(spec.editAction && O.currentUser.allowed(spec.editAction)) {
        E.renderIntoSidebar({
            elements: [{href:"/do/public-information-edit/"+name, label:"Edit", indicator:"standard"}]
        }, "std:ui:panel");
    }
    E.render({
        spec: spec,
        page: spec.form ? spec.form.instance(page.lastCommittedDocument) : PAGE_FORM.instance(page.lastCommittedDocument)
    }, "page");
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/public-information-edit", [
    {pathElement:0, as:"string"}
], function(E, name) {
    if(!(name in pages)) { O.stop("No such information page"); }
    var spec = pages[name];
    if(!spec.editAction) { O.stop("Not permitted"); }
    spec.editAction.enforce();
    var page = PageStore.instance(name);
    page.handleEditDocument(E, EDITOR);
});

var EDITOR = {
    finishEditing: function(instance, E, complete) {
        if(complete) {
            instance.commit(O.currentUser);
        }
        E.response.redirect("/do/public-information/"+instance.key);
    },
    gotoPage: function(instance, E, formId) {
        E.response.redirect("/do/public-information-edit/"+instance.key+'/'+formId);
    },
    render: function(instance, E, deferredRender) {
        E.render({spec:pages[instance.key],deferred:deferredRender}, "edit");
    }
};
