/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*HaploDoc
node: /haplo_information_pages
title: Haplo Information Pages
sort: 60
module_owner: Ben
--

Build a page which combines information from many plugins.

h2(service). "haplo:information_page:overview"

This service is called when you want to render the information page. It takes a @specification@ \
and returns a @builder@ object, with a few extra properties.

@specification@ has properties:

* pageTitle - title of the page
* backLink - (optional) back link for the page
* object - (optional) object this page is about
* buildService - (optional) name of service to be called with (object, builder)
* layout - (optional) defaults to "std:standard"

If you specify an @object@, the page title will add ": object.title", and the backLink will \
be set to the object page if not otherwise specified.

The returned @builder@, which is also passed to @buildService@ has the additional properties:

* @keyObject@, a function to add an object as a linked heading to the page, takes @sort@ and @object@
* @section@, a function to add a section to the builder, takes @sort@ and @deferred@
* @link@, a function to add a link to the sidebar, takes @sort@, @href@ and @label@
* @sidebar@, a @PanelBuilder@ object for the sidebar
* @respond@, a function to render the information page, takes @E@
* @specification@, the specification defined above

@buildService@ can be implemented in different plugins to extend the information page.

When the buildService is called, the builder has the E property to allow \
access to the Exchange, eg for parameters. Use with care as parameters \
may clash with other sections added to this page.

Example of use, within the handler controlling the page:

<pre>
const builder = O.service("haplo:information_page:overview", {
    buildService: "my_plugin:overview",
    pageTitle: "My applications",
    object: researcher
}).
    keyObject(0, researcher).
    section(100, P.template("my_template").deferredRender({})).
    link(100, url, "Label for link").
    respond(E);
</pre>

In another plugin you want to extend this page:

<pre>
P.implementService("my_plugin:overview", function(object, builder) {
    builder.
        section(200, P.template("below_my_template").deferredRender({})).
        sidebar.link();
});
</pre>

*/

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

