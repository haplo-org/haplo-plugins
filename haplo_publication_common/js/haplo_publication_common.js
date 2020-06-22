/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
//   SIMPLE OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "haplo:publication-common:page:simple-object",
    "pages/simple-object"
);

P.webPublication.registerReplaceableTemplate(
    "haplo:publication-common:page:simple-main-object",
    "pages/simple-main-object"
);

P.webPublication.feature("haplo:publication-common:simple-object", function(publication, spec) {

    spec = spec || {};
    let kind = spec.kind,
        template = spec.template || "haplo:publication-common:page:simple-object";

    var handleFn = function(E, context, object) {
        if(kind) {
            context.hint.objectKind = kind;
        }
        var widget = P.webPublication.widget.object(object);
        if(spec.withoutAttributes !== undefined) {
            widget.withoutAttributes(spec.withoutAttributes);
        }
        if(spec.onlyAttributes !== undefined) {
            widget.onlyAttributes(spec.onlyAttributes);
        }
        E.render({
            object: widget,
            imagePagePartCategory: spec.imagePagePartCategory
        }, context.publication.getReplaceableTemplate(template));
    };

    if(spec.TEMP_selectObject) {
        publication.TEMP_respondWithSelectedObject(spec.path,
            spec.types,
            spec.TEMP_selectObject,
            handleFn
        );
    } else {
        publication.respondWithObject(spec.path,
            spec.types,
            handleFn
        );
    }

});


// --------------------------------------------------------------------------
//   LIST OF OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "haplo:publication-common:page:simple-object-list",
    "pages/simple-object-list"
);

P.webPublication.feature("haplo:publication-common:simple-object-list", function(publication, spec) {

    spec = spec || {};
    let template = spec.template || "haplo:publication-common:page:simple-object-list";

    publication.respondToExactPath(spec.path,
        function(E, context) {
            E.render({
                spec: spec,
                objects: {
                    results: O.query().
                        link(spec.types, A.Type).
                        sortByTitle().execute()
                }
            }, context.publication.getReplaceableTemplate(template));
        }
    );

});

// --------------------------------------------------------------------------
// Tab navigation
// --------------------------------------------------------------------------


P.webPublication.registerReplaceableTemplate(
    "haplo:publication-common:part:tab-navigation",
    "replaceable/parts/tabs"
);

P.webPublication.feature("haplo:publication-common:tab-navigation", function(publication, spec) {

    P.webPublication.pagePart({
        name: "haplo:publication-common:tabs",
        deferredRender: function(E, context, options) {
            let tabs = [];
            spec.tabs.forEach((t) => {
                let href = t.home ? spec.HOME_PATH : spec.BASE_PATH+t.href;
                tabs.push({
                    label: t.label,
                    href: href,
                    active: t.home ? context.hint.isHomePage : E.request.path.startsWith(href)
                });
            });
            return context.publication.getReplaceableTemplate("haplo:publication-common:part:tab-navigation").deferredRender(tabs);
        }
    });
});