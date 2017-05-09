/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Build a page which combines information from many plugins.
// specification has properties:
//   pageTitle - title of the page
//   object - (optional) object this page is about
//   buildService - (optional) service to be called with (object, builder)
//
//  When the buildService is called, the builder has the E property to allow
//  access to the Exchange, eg for parameters. Use with care as parameters
//  may clash with other sections added to this page.

P.implementService("haplo:information_page:overview", function(specification) {
    var sections = [], links = [];
    var builder = new OverviewPageBuilder(specification);
    return builder;
});

// --------------------------------------------------------------------------

var OverviewPageBuilder = function(specification) {
    this.specification = specification;
    this.$keyObjects = [];
    this.$sections = [];
    this.$links = [];
    this.sidebar = O.ui.panel();
};

// Add things to the page
OverviewPageBuilder.prototype.keyObject = function(sort, objectOrRef) {
    if(objectOrRef) {
        this.$keyObjects.push({sort:sort, key:objectOrRef});
    }
    return this;
};
OverviewPageBuilder.prototype.section = function(sort, deferred) {
    this.$sections.push({sort:sort, deferred:deferred});
    return this;
};
OverviewPageBuilder.prototype.link = function(sort, href, label) {
    this.$links.push({sort:sort, href:href,label:label});
    return this;
};
// and also builder.sidebar is a PanelBuilder for the sidebar.

// Respond with the combined page
OverviewPageBuilder.prototype.respond = function(E) {
    this.E = E;
    var specification = this.specification;
    if(specification.buildService) {
        O.serviceMaybe(specification.buildService, specification.object, this);
    }
    E.setResponsiblePlugin(P);
    E.renderIntoSidebar({
        links: _.sortBy(this.$links, 'sort'),
        panel: this.sidebar.deferredRender()
    }, "overview/right");
    E.render({
        specification: this.specification,
        keyObjects: _.sortBy(this.$keyObjects, 'sort'),
        sections: _.sortBy(this.$sections, 'sort'),
        layout: this.specification.layout || "std:standard"
    }, "overview/page");
};

