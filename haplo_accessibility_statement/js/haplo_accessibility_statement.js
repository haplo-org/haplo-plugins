/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CanEditAccessibilityStatements = O.action("haplo:action:accessibility-statement:can-edit-statements").
    title("Can edit the accessibility statements");

// --------------------------------------------------------------------------

P.hook("hNavigationPosition", function(response, name) {
    let i = P.locale().text("template");
    if(name === "haplo:accessibility-statement:links") {
        let navigation = response.navigation;
        navigation.separator();
        navigation.link("/do/accessibility-statement", i["Accessibility"]);
        response.navigation = navigation;
    }
});

// --------------------------------------------------------------------------

var EditStatementForm = P.form("accessibility_statement", "form/accessibility_statement.json");

const VALID_KEY = /^[a-z_]+$/;

//Key is the locale id
var accessibilityStore = P.defineDocumentStore({
    name: "accessibilityStatement",
    keyIdType: "text",
    blankDocumentForKey: function(key) {
        if(!VALID_KEY.test(key)) { throw new Error("Invalid locale ID"); }
        try {
            return {
                statement: P.loadFile("default/"+key+".xml").readAsString("utf-8")
            };
        } catch(e) {
            console.log("Ignoring error when loading default accessibility statement: "+e);
        }
        return {};
    }
});

var getStatement = function(localeId) {
    if(!localeId) { localeId = P.locale().id; }
    localeId = localeId.toLowerCase();
    return accessibilityStore.instance(localeId).currentDocument.statement;
};

P.implementService("haplo:accessibility_statement:get_deferred_statement", function() {
    return P.template("display-statement").deferredRender({
        statement: getStatement()
    });
});

P.respond("GET", "/do/accessibility-statement", [
    {pathElement:0, as:"string", optional: true}
], function(E, localeId) {
    E.render({
        statement: getStatement(localeId),
        canEdit: O.currentUser.allowed(CanEditAccessibilityStatements)
    }, "display-statement");
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-accessibility-statement/edit-statement", [
    {pathElement:0, as:"string", optional: true}
], function(E, key) {
    CanEditAccessibilityStatements.enforce();
    if(key) {
        key = key.toLowerCase();
        let instance = accessibilityStore.instance(key),
            statement = instance.currentDocument,
            form = EditStatementForm.handle(statement, E.request);

        if(form.complete) {
            instance.setCurrentDocument(statement, true);
            return E.response.redirect("/do/accessibility-statement/"+key);
        }
        E.render({ form: form });
    } else {
        E.render({
            options: _.map(O.service("std:i18n:locales:active:id"), localeId => {
                let locale = P.locale(localeId),
                    name0 = locale.name,
                    name1 = locale.nameInLanguage;
                return {
                    label: name0 + ((name0 !== name1) ? " / "+name1 : ''),
                    action: "/do/haplo-accessibility-statement/edit-statement/"+localeId,
                    indicator: "default"
                };
            })
        }, "edit-choose-locale");
    }
});
