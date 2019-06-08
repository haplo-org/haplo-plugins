/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:qa-audit:gather-information", function(audit) {
    if(O.serviceImplemented("__qa__:haplo_descriptive_object_labelling:internals")) {
        addLabellingInformation(audit);
    }
    if(O.serviceImplemented("__qa__:haplo_user_roles_permissions:internals")) {
        addUserRolesInformation(audit);
    }
});

// --------------------------------------------------------------------------

var labelRefToCode = O.refdict();
_.each(_.extend({},SCHEMA.LABEL), function(ref, code) { labelRefToCode.set(ref, code); });

var typeRefToCode = O.refdict();
_.each(_.extend({},SCHEMA.TYPE), function(ref, code) { typeRefToCode.set(ref, code); });

var descToCode = O.refdict();
_.each(_.extend({},SCHEMA.ATTR), function(desc, code) { descToCode[desc] = code; });

var gidToCode = O.refdict();
_.each(_.extend({},SCHEMA.GROUP), function(gid, code) { gidToCode[gid] = code; });

var permNames = [
    [O.PERM_READ, "read"],
    [O.PERM_CREATE, "create"],
    [O.PERM_UPDATE, "update"],
    [O.PERM_RELABEL, "relabel"],
    [O.PERM_DELETE, "delete"],
    [O.PERM_APPROVE, "approve"]
];
var expandPerms = function(perm) {
    var p = {};
    permNames.forEach(function(x) { if(perm&x[0]) { p[x[1]] = true; }});
    if(perm === O.PERM_ALL) { p.ALL = true; }
    return p;
};

// --------------------------------------------------------------------------

var labelsToCodes = function(list) {
    return _.map(list, function(ref) {
        return labelRefToCode.get(ref) || '????';
    });
};

var attrDescsToCode = function(list) {
    return _.map(list, function(desc) {
        return SCHEMA.getAttributeInfo(desc).code || '????';
    });
};

// --------------------------------------------------------------------------


var addLabellingInformation = function(audit) {
    var i = O.service("__qa__:haplo_descriptive_object_labelling:internals");
    var allTypes = O.refdict();
    _.each(i, function(refdict, key) {
        refdict.each(function(ref) {
            if(!allTypes.get(ref)) {
                var ti = SCHEMA.getTypeInfo(ref);
                var v = {
                    code: ti.code,
                    name: ti.name,
                    isRootType: ref == ti.rootType
                };
                if(!v.isRootType) {
                    v.rootType = SCHEMA.getTypeInfo(ti.rootType).code;
                }
                allTypes.set(ref, v);
            }
        });
    });
    var types = {};
    var refToType = O.refdict();
    allTypes.each(function(ref, i) {
        types[i.code] = i;
        refToType.set(ref, i);
    });

    i.typeIsSelfLabelling.each(function(ref, value) {
        if(value) { refToType.get(ref).selfLabelling = true; }
    });
    i.typeIsWorkflowIntegrated.each(function(ref, value) {
        if(value) { refToType.get(ref).workflowIntegrated = true; }
    });
    i.typeLabelWithCreator.each(function(ref, value) {
        if(value) { refToType.get(ref).labelWithCreator = true; }
    });
    i.typeLabels.each(function(ref, value) {
        refToType.get(ref).labels = labelsToCodes(value);
    });
    i.typeLabelWith.each(function(ref, value) {
        refToType.get(ref).labelWith = attrDescsToCode(value);
    });
    i.typeLabelsFromLinked.each(function(ref, value) {
        var l = [];
        _.each(value, function(linkedAttrs, desc) {
            l.push({
                thisAttribute: SCHEMA.getAttributeInfo(desc).code || '????',
                labelsFromLinkedObject: attrDescsToCode(linkedAttrs)
            });
        });
        refToType.get(ref).labelsFromLinked = l;
    });

    // Got any labelling info?
    var NON_LABELLING_PROPERTIES = ["code", "name", "isRootType", "rootType"];
    _.each(types, function(info, code) {
        info.hasLabelling = _.difference(_.keys(info), NON_LABELLING_PROPERTIES).length !== 0;
    });

    audit.addInformation("descriptive-labelling", "Descriptive object labelling", types);
};

// --------------------------------------------------------------------------

var addUserRolesInformation = function(audit) {
    var i = O.service("__qa__:haplo_user_roles_permissions:internals");

    var permList = function(refdict) {
        var perms = [];
        refdict.each(function(ref, perm) {
            if(labelRefToCode.get(ref)) {
                perms.push(["label", labelRefToCode.get(ref), expandPerms(perm)]);
            } else if(typeRefToCode.get(ref)) {
                perms.push(["type", typeRefToCode.get(ref), expandPerms(perm)]);
            } else {
                perms.push(["unknown", ref.toString(), expandPerms(perm)]);
            }
        });
        return perms;
    };

    // ---

    var roles = {};

    i.roles.each(function(type, info) {
        _.each(info, function(list, descstr) {
            var desc = 1*descstr;
            _.each(list, function(r) {
                if(!roles[r.role]) { roles[r.role] = {}; }
                var ri = roles[r.role];
                if(!ri.definedByObjects) { ri.definedByObjects = []; }
                var rd = ri.definedByObjects;
                var x = {
                    type: typeRefToCode.get(type) || '????',
                    attribute: descToCode[desc] || '????'
                };
                if(r.objectAttr) {
                    x.objectAttribute = descToCode[1*r.objectAttr] || '????';
                }
                rd.push(x);
            });
        });
    });

    _.each(i.rolePermissions, function(refdict, name) {
        if(!roles[name]) { roles[name] = {}; }
        roles[name].permissions = permList(refdict);
    });
    _.each(i.roleRestrictionLabels, function(labelList, name) {
        if(!roles[name]) { roles[name] = {}; }
        roles[name].restrictionLabels = labelsToCodes(labelList);
    });

    // ---

    var groupInfoById = {};

    _.each(i.groupPermissions, function(refdict, gid) {
        if(!groupInfoById[gid]) { groupInfoById[gid] = {}; }
        groupInfoById[gid].permissions = permList(refdict);
    });
    _.each(i.groupRestrictionLabels, function(labels, gid) {
        if(!groupInfoById[gid]) { groupInfoById[gid] = {}; }
        groupInfoById[gid].restrictionLabels = labelsToCodes(labels);
    });
    _.each(i.administratorGroups, function(gid) {
        if(!groupInfoById[gid]) { groupInfoById[gid] = {}; }
        groupInfoById[gid].isAdministrator = true;
    });
    _.each(i.groupPersonalRoles, function(roles, gid) {
        if(!groupInfoById[gid]) { groupInfoById[gid] = {}; }
        groupInfoById[gid].roles = roles;
    });

    // Reassemble into map from code -> info
    var groups = {};
    _.each(groupInfoById, function(x, gid) {
        groups[gidToCode[gid] || "ID:"+gid] = x;
    });

    var information = {
        roles: roles,
        groups: groups
    };
    audit.addInformation("user-roles", "User roles", information);
};
