/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.element("alternative_versions", "Alternative versions of objects", function(L) {
    let authoritative,
        alternatives = [];
    if(L.object.labels.includes(Label.AlternativeVersion)) {
        let authMaybe = L.object.first(A.AuthoritativeVersion);
        if(authMaybe) {
            authoritative = authMaybe.load();
            alternatives = P.alternateVersionsForObject(authMaybe);
        } else {
            alternatives = [L.object];
        }
    } else {
        authoritative = L.object;
        alternatives = P.alternateVersionsForObject(L.object.ref);
    }

    if(alternatives.length) {
        let tabs = [];
        _.each(alternatives, (alt) => {
            if(!O.currentUser.canRead(alt)) { return; }
            let source = O.serviceMaybe("haplo_alternative_versions:source_for_alternative_object", alt);
            tabs.push({
                href: alt.url(),
                label: source ? source.name : "(unknown)",
                selected: (alt.ref == L.object.ref)
            });
        });
        if(authoritative) {
            tabs.unshift({
                href: authoritative.url(),
                label: "Authoritative record",
                selected: (authoritative.ref == L.object.ref)
            });
        }
        L.render({
            isAuthoritative: (!!authoritative && (authoritative.ref == L.object.ref)),
            "std:ui:tabs:links": {
                tabs: tabs
            },
            "std:ui:notice": {
                message: "This is not the authoritative record for this object."
            }
        }, "tabs-element");
    }
});

P.implementService("std:action_panel:*", function(display, builder) {
    let object = display.object,
        panelName = display.options.panel;
    if(object) {
        if(object.labels.includes(Label.AlternativeVersion) && (panelName !== "alternative_versions")) {
            // Prevent display of usual object action panels on alternative versions
            builder.hideAllPanels();
        }
        if(!object.labels.includes(Label.AlternativeVersion) && (panelName === "alternative_versions")) {
            // Prevent display of alternative version panels on authoritative records
            builder.hideAllPanels();
        }
    }
});

P.implementService("std:action_panel:alternative_versions", function(display, builder) {
    // Show attributes that are different to the authoritative version, if one exists
    if(display.object.first(A.AuthoritativeVersion)) {
        let changedAttrs = P.changedAttributes(display.object);
        if(changedAttrs.length) {
            let changePanel = builder.panel(25);
            changePanel.element(5, {title:"Fields different to authoritative record"});
            _.each(changedAttrs, (d) => {
                changePanel.element(25, {label: SCHEMA.getAttributeInfo(d).name});
            });
        }
    }
});
