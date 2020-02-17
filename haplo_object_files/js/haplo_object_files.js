/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var canCreateAnyFile = O.action("hres:action:object-files:can-create-any-file");

var attachFileButtonShouldBeDisplayed = function(object) {
    if(O.currentUser.can("update", object.ref) || O.currentUser.allowed(canCreateAnyFile)) {
        return true;
    }
};

P.provideFeature("haplo:object-files", function(plugin) {
    plugin.objectFiles = function(spec) {
        let objectTypes = spec.objectTypes;
        plugin.hook("hObjectDisplay", function(response, object) {
            if(!_.find(objectTypes, (t) => object.isKindOf(t))) { return; }
            if(!attachFileButtonShouldBeDisplayed(object)) { return; }
            if(O.serviceMaybe("haplo_object_files:hide-attach-file-button", object)) { return; }

            response.buttons["*OBJECTFILE"] = 
                [[spec.basePath+"/new/"+object.ref, "Attach file"]];
        });

        plugin.respond("GET,POST", spec.basePath+"/new", [
            {pathElement:0, as:"object"}
        ], function(E, object) {
            E.setResponsiblePlugin(P);
            if(!attachFileButtonShouldBeDisplayed) { O.stop("Unauthorised"); }
            var templateObject = O.object();
            templateObject.appendType(spec.defaultType || spec.parentType);
            if(O.currentUser.ref) {
                templateObject.append(O.currentUser.ref, A.Author);
            }
            templateObject.append(O.datetime(
                new Date(), undefined, O.PRECISION_DAY), A.Date);

            if(spec.objectAttribute) {
                templateObject.append(object.ref, spec.objectAttribute);
            }

            spec.updateTemplateObject(templateObject, object);
            let view = {
                pageTitle: "Add new file",
                backLink: object.url(),
                templateObject: templateObject,
                readOnlyAttributes: spec.readOnlyAttributes
            };
            E.render(view, "std:new_object_editor");
        });

        P.element(spec.elementName, spec.elementTitle, function(L) {
            let view;
            if(spec.elementView) {
                view = spec.elementView(L);
            } else {
                var files = [];
                if(_.find(objectTypes, (t) => L.object.isKindOf(t))) {
                    files = O.query().link(spec.parentType, A.Type).link(L.object.ref, spec.objectAttribute).sortBy("date").execute();
                }
                var fileListByType = O.refdict(function() { return []; });
                _.each(files, function(file) {
                    var type = file.firstType();
                    fileListByType.get(type).push(file);
                });
                var items = [];
                fileListByType.each(function(type, list) {
                    items.push({
                        ref: type,
                        name: type.load().title,
                        count: list.length,
                        files: list
                    });
                });
                items.sort(function(a, b) { return a.name.localeCompare(b.name); });
                view = {items: items };
            }
            L.render(view, "files");
        });

        P.hook("hObjectDisplay", function(response, object) {
            if(object.isKindOf(spec.parentType) && spec.objectAttribute) {
                let attachedObject = object.first(spec.objectAttribute);
                if(attachedObject) {
                    response.backLink = attachedObject.load().url();
                    let attributeInfo = SCHEMA.getAttributeInfo(spec.objectAttribute);
                    response.backLinkText = attributeInfo.name || "Back";
                }
            }
        });

        P.element("version_history", "Version history table",
            function(L) {
                let versions = O.serviceMaybe("haplo:object-files:get-versions-for-implementation", spec.elementName);
                if(versions) {
                    let data = [{ rowName: "Current version", version: L.object.version, date: L.object.lastModificationDate }];
                    _.each(versions, (v) => {
                        let date = v.getVersionDate(L.object);
                        let version = date ? getVersionAtDate(L.object, date) : undefined;
                        data.push({
                            rowName: v.rowName,
                            version: version,
                            date: date
                        });
                    });
                    L.render({
                        data: data
                    });
                }
            }
        );
    };
});

var getVersionAtDate = function(object, date) {
    if(object.lastModificationDate < date) { return object.version; }
    var tmp = _.find(_.clone(object.history).reverse(), function(v) { return v.lastModificationDate < date; }) || { version: "" };
    return tmp.version; 
};

